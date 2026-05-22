const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { renderDiaryDocx } = require('./docx.cjs');

const isDev = !app.isPackaged;

function createAppMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        { role: 'reload', label: '刷新' },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { role: 'resetZoom', label: '重置缩放' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'close', label: '关闭' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 720,
    title: '监理日记生成器',
    backgroundColor: '#f4f2ed',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    win.loadURL('http://127.0.0.1:5173');
  } else {
    win.loadFile(path.join(__dirname, '../../dist-web/index.html'));
  }
}

function getTemplatePath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'templates', '个人监理日记模板.docx');
  }

  return path.join(app.getAppPath(), 'resources', 'templates', '个人监理日记模板.docx');
}

function getDataDir() {
  const dir = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getDiaryStorePath() {
  return path.join(getDataDir(), 'diaries.json');
}

function readDiaryStore() {
  const storePath = getDiaryStorePath();
  if (!fs.existsSync(storePath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(storePath, 'utf8'));
  } catch {
    const backupPath = `${storePath}.broken-${Date.now()}.bak`;
    fs.copyFileSync(storePath, backupPath);
    return {};
  }
}

function writeDiaryStore(store) {
  fs.writeFileSync(getDiaryStorePath(), JSON.stringify(store, null, 2), 'utf8');
}

function getDiaryTitle(diary) {
  const parts = [
    diary.constructionStatus,
    diary.inspectionWork,
    diary.materialAcceptance,
    diary.issuesAndActions
  ];
  const firstLine = parts
    .join('\n')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find(Boolean);

  return firstLine || '空白日记';
}

const weatherCodeMap = {
  0: '晴',
  1: '晴',
  2: '多云',
  3: '阴',
  45: '雾',
  48: '雾',
  51: '小雨',
  53: '小雨',
  55: '中雨',
  56: '冻雨',
  57: '冻雨',
  61: '小雨',
  63: '中雨',
  65: '大雨',
  66: '冻雨',
  67: '冻雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  77: '雪',
  80: '阵雨',
  81: '阵雨',
  82: '暴雨',
  85: '阵雪',
  86: '阵雪',
  95: '雷阵雨',
  96: '雷阵雨',
  99: '雷阵雨'
};

function weatherText(code) {
  return weatherCodeMap[code] || '多云';
}

function windDirectionText(degree) {
  if (degree === null || degree === undefined || Number.isNaN(Number(degree))) {
    return '';
  }

  const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  const index = Math.round((((Number(degree) % 360) + 360) % 360) / 45) % 8;
  return directions[index];
}

function beaufortLevel(speedKmh) {
  const speed = Number(speedKmh);
  if (Number.isNaN(speed)) return '';

  const thresholds = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117];
  const level = thresholds.findIndex((limit) => speed < limit);
  const normalized = level === -1 ? 12 : level;
  return normalized <= 3 ? '≤3' : `${normalized}`;
}

function pickHourlyValue(hourly, key, date, hour) {
  const target = `${date}T${String(hour).padStart(2, '0')}:00`;
  const index = hourly.time.findIndex((time) => time === target);
  if (index >= 0) return hourly[key][index];

  const sameDayIndex = hourly.time.findIndex((time) => String(time).startsWith(`${date}T`));
  return sameDayIndex >= 0 ? hourly[key][sameDayIndex] : null;
}

function firstForecastDate(forecast) {
  const dailyDate = forecast.daily?.time?.[0];
  if (dailyDate) return dailyDate;

  const hourlyTime = forecast.hourly?.time?.[0];
  return hourlyTime ? String(hourlyTime).slice(0, 10) : null;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }
  return response.json();
}

async function fetchWeatherByCity({ city, date }) {
  const keyword = String(city || '').trim();
  if (!keyword) {
    throw new Error('请先输入城市');
  }

  const targetDate = date || new Date().toISOString().slice(0, 10);
  const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(keyword)}&count=1&language=zh&format=json`;
  const geocode = await fetchJson(geocodeUrl);
  const place = geocode.results?.[0];

  if (!place) {
    throw new Error(`没有找到城市：${keyword}`);
  }

  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
  forecastUrl.searchParams.set('latitude', place.latitude);
  forecastUrl.searchParams.set('longitude', place.longitude);
  forecastUrl.searchParams.set('timezone', 'Asia/Shanghai');
  forecastUrl.searchParams.set('start_date', targetDate);
  forecastUrl.searchParams.set('end_date', targetDate);
  forecastUrl.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant');
  forecastUrl.searchParams.set('hourly', 'weather_code,relative_humidity_2m');

  let forecast;
  try {
    forecast = await fetchJson(forecastUrl.toString());
  } catch {
    forecastUrl.searchParams.delete('start_date');
    forecastUrl.searchParams.delete('end_date');
    forecastUrl.searchParams.set('forecast_days', '1');
    forecast = await fetchJson(forecastUrl.toString());
  }
  const availableDate = firstForecastDate(forecast);
  if (!availableDate) {
    throw new Error('天气接口没有返回可用数据');
  }

  const forecastDate = forecast.daily?.time?.includes(targetDate) ? targetDate : availableDate;
  const daily = forecast.daily || {};
  const hourly = forecast.hourly || {};

  const dayIndex = Math.max(0, daily.time?.findIndex((time) => time === forecastDate) ?? 0);
  const morningCode = pickHourlyValue(hourly, 'weather_code', forecastDate, 9);
  const afternoonCode = pickHourlyValue(hourly, 'weather_code', forecastDate, 15);
  const humidity = pickHourlyValue(hourly, 'relative_humidity_2m', forecastDate, 15);
  const max = Math.round(Number(daily.temperature_2m_max?.[dayIndex]));
  const min = Math.round(Number(daily.temperature_2m_min?.[dayIndex]));
  const windSpeed = daily.wind_speed_10m_max?.[dayIndex];
  const windDirection = daily.wind_direction_10m_dominant?.[dayIndex];

  return {
    city: place.name,
    country: place.country,
    date: forecastDate,
    weatherMorning: weatherText(morningCode),
    weatherAfternoon: weatherText(afternoonCode ?? morningCode),
    temperature: `${min}/${max}`,
    humidity: humidity === null || humidity === undefined ? '' : String(Math.round(Number(humidity))),
    windDirection: windDirectionText(windDirection),
    windPower: beaufortLevel(windSpeed)
  };
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let body = fenced ? fenced[1].trim() : raw;
  body = body.replace(/^[﻿​]+/, '');
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');

  if (start < 0 || end < start) {
    const err = new Error('AI 没有返回可解析的 JSON');
    err.code = 'AI_NO_JSON';
    throw err;
  }

  const candidate = body.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch (e) {
    const repaired = candidate
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");
    try {
      return JSON.parse(repaired);
    } catch {
      const err = new Error(`JSON 解析失败：${e instanceof Error ? e.message : String(e)}`);
      err.code = 'AI_BAD_JSON';
      throw err;
    }
  }
}

const PERSONNEL_CATEGORY_HINT = [
  '可识别对象包括但不限于：总包单位、分包单位、劳务单位、专业施工单位，',
  '以及土建班组、钢筋班组、木工班组、混凝土班组、砌筑班组、抹灰班组、水电班组、',
  '消防班组、暖通班组、外架班组、防水班组、门窗班组、装饰装修班组、',
  '保温分包单位、机电分包单位、智能化班组、电梯班组等用户明确写出的单位或班组。',
  '不要把没有出现在用户输入里的单位或班组写入结果。'
].join('');

const MACHINERY_VOCAB_HINT = [
  '常见施工机械包括但不限于：塔吊、施工电梯、物料提升机、汽车吊、履带吊、随车吊、',
  '挖掘机、装载机、推土机、压路机、摊铺机、混凝土泵车、车载泵、地泵、布料机、',
  '钢筋加工机械、钢筋调直机、钢筋弯曲机、钢筋切断机、电焊机、套丝机、',
  '砂浆搅拌机、混凝土搅拌机、发电机、空压机、吊篮、高空作业车、叉车、',
  '运输车辆、渣土车、洒水车等。'
].join('');

const ANTI_HALLUCINATION_RULES = [
  '【严格禁止】不得虚构以下任何信息：',
  '1. 不得编造施工单位名称、分包单位名称、班组名称；',
  '2. 不得编造班组人数或单位人数；用户未给数字就不要写数字；',
  '3. 不得编造机械数量；用户未给数量就只写名称、不写台数；',
  '4. 不得编造工程量、完成百分比、楼层、轴线、标高、混凝土方量等；',
  '5. 不得编造验收结论、整改闭合结果、隐蔽验收意见；',
  '6. 不得编造停工、罚款、事故、重大隐患、设计变更、签证、索赔；',
  '7. 不得凭施工内容反向推断必然使用了某机械，除非用户已经明确提到；',
  '8. 不得为了凑齐人数合计而虚构班组；合计必须等于用户输入中各单位/班组人数之和。'
].join('\n');

function buildAiPrompt(mode, diary, glossary) {
  const fieldList = [
    'constructionStatus',
    'contractorPersonnel',
    'machinery',
    'inspectionWork',
    'materialAcceptance',
    'acceptanceWork',
    'standingWork',
    'meeting',
    'internalWork',
    'issuesAndActions',
    'otherMatters'
  ];

  const personnelRules = [
    '【contractorPersonnel 人员投入识别规则】',
    '从用户输入(主要看 constructionStatus，其次看其他字段)中识别每个施工单位、分包单位、班组的当日施工人数。',
    PERSONNEL_CATEGORY_HINT,
    '输出格式（每行一项，最后一行写合计）：',
    '1. XX单位/班组：XX人',
    '2. XX单位/班组：XX人',
    '...',
    '合计：XX人',
    '回退规则：',
    'A. 用户只给出了现场总人数、未明确各单位/班组时，输出："当前记录仅能识别现场总人数为 XX 人，未明确各施工单位或班组人数，建议补充各单位人员投入情况。\\n合计：XX人"。',
    'B. 用户完全未提供任何人数时，输出："当前记录未提供施工人员数量，建议补充各施工单位、分包单位或班组当日投入人数。"，不得输出"合计"。',
    'C. 严禁把"钢筋工 10 人、木工 8 人"等具体人数凭空补出来。'
  ].join('\n');

  const machineryRules = [
    '【machinery 施工机械识别规则】',
    '【重要 扫描范围】必须扫描用户草稿里所有字段(尤其 constructionStatus / 施工部位及施工状态、其次 inspectionWork、acceptanceWork、standingWork、issuesAndActions、machinery 自身)中出现的施工机械,统一汇总到 machinery 字段。如果机械只在 constructionStatus 里出现、machinery 字段为空,也必须把这些机械汇总写入 machinery。同一机械在多处出现按其中最明确的数量计一次,不要重复列出。',
    MACHINERY_VOCAB_HINT,
    '输出格式（每行一项,按出现顺序排列）：',
    '1. 机械名称：XX台',
    '2. 机械名称：XX台',
    '...',
    '回退规则：',
    'A. 用户在任一字段提到了机械名称但未写数量时，输出："已识别机械：A、B、C。\\n当前记录未提供具体数量，建议补充机械数量。"',
    'B. 所有字段都没提到机械时，输出："当前记录未提供施工机械投入情况，建议补充主要机械设备名称、数量及使用部位。"',
    'C. 严禁把用户任何字段都没提到的机械加入清单，严禁根据施工内容反推某机械"必然在场"。',
    'D. constructionStatus 里写"投入塔吊 1 台、泵车 1 台"等具体台数,必须同样体现在 machinery 字段里。'
  ].join('\n');

  const constructionStatusRules = [
    '【constructionStatus 今日施工情况】',
    '用监理日记正式语言整理用户输入：写明施工部位、施工内容、涉及专业或工序、人员/机械投入是否明确、施工是否正常推进。',
    '不得删除用户已经提供的部位、楼栋、人数、作业内容等细节；只允许整理语序、标点、分项编号。',
    '不得虚构工程量、完成比例、楼层、轴线、验收结论。',
    '如用户输入很少，写保守表述并提示"建议补充……"。'
  ].join('\n');

  const inspectionWorkRules = [
    '【inspectionWork 巡视检查工作】（本次重点）',
    '生成一段或分项的监理巡视检查内容，必须覆盖以下角度（与用户输入对应的角度才写，无依据的角度不要硬写）：',
    '1) 对施工部位和施工工序的巡视；',
    '2) 对人员到岗和作业组织的检查；',
    '3) 对施工机械使用情况的检查；',
    '4) 对现场质量控制情况的检查；',
    '5) 对安全文明施工措施落实情况的检查；',
    '6) 对发现问题的提醒、要求整改或后续复查建议；',
    '7) 用户输入很少时，使用保守表述并提示"建议补充……"。',
    '严禁直接虚构"未发现质量安全异常"以外的检查结论；严禁编造钢筋规格、间距、保护层厚度等具体数值。'
  ].join('\n');

  const otherFieldRules = [
    '【其他字段写作规则】',
    'materialAcceptance（材料验收/见证取样工作）：',
    '  默认不填任何内容。必须原样回写用户草稿当前值，无论 analyze 还是 polish 模式都不得改动；',
    '  用户草稿为空字符串时，必须返回空字符串 ""，不得填"无。"、不得编造、不得提示"建议补充"；',
    '  只有用户已经在此字段亲自写了内容，才照抄返回，且不得改写、不得"润色"。',
    'acceptanceWork / standingWork / meeting / internalWork / otherMatters：',
    '  用户输入里没有对应内容时，必须填"无。"，不得编造。',
    'issuesAndActions（问题与措施 / 建议补充信息）：',
    '  把"当前输入中缺少但影响日志完整性的内容"作为建议补充列在此字段，例如人数缺失、机械数量缺失、施工部位不清等；',
    '  如用户已经描述了现场异常或整改要求，按"问题—措施—复查"的顺序整理；',
    '  没有任何问题且没有建议补充时，填"无。"。'
  ].join('\n');

  const formalStyleRule = '【语言风格】使用监理日记正式语言，客观、规范、简洁；多项内容用 1. 2. 3. 编号；不要口语化总结。';

  const glossaryBlock = (() => {
    const text = String(glossary || '').trim();
    if (!text) return '';
    return [
      '【本项目术语 - 优先使用，禁止替换为其它名称】',
      '以下是用户为本项目登记的单位、班组、机械、工种等术语。当用户输入提到对应实体时，必须使用这里的名称；不得改写、缩写或替换成同义词。但仍然不得把这里出现的名称无中生有地加到用户没有提到的情况中。',
      text
    ].join('\n');
  })();

  const sections = [
    '你是一名经验丰富的中国建设工程监理工程师，正在协助填写《个人监理日记》。',
    '请根据用户提供的监理日记草稿，按下列规则输出每个字段的内容。',
    formalStyleRule,
    ANTI_HALLUCINATION_RULES,
  ];
  if (glossaryBlock) sections.push(glossaryBlock);
  sections.push(
    personnelRules,
    machineryRules,
    constructionStatusRules,
    inspectionWorkRules,
    otherFieldRules,
    mode === 'analyze'
      ? '【本次任务】analyze 模式：根据用户输入分析并补全监理工作内容，需要生成 constructionStatus、contractorPersonnel、machinery、inspectionWork、issuesAndActions 等所有字段；用户已经填写的字段以用户内容为准并润色，未填字段按上述规则生成或填"无。"。'
      : '【本次任务】polish 模式：只允许修改 constructionStatus 和 inspectionWork 两个字段，其他字段必须原样返回用户草稿当前值，不得润色、改写、增删；constructionStatus 不得精简内容；inspectionWork 应围绕 constructionStatus 的每段施工内容逐项生成。',
    `【输出格式】只返回一个 JSON 对象，不要 Markdown，不要解释，不要 \`\`\`。JSON 字段必须且只能包含：${fieldList.join(', ')}。`,
    '每个字段的值都是纯文本字符串，可以包含换行 \\n 和 1. 2. 3. 编号；不要在值里嵌套 JSON 或 Markdown 代码块。',
    '当前草稿（JSON）：',
    JSON.stringify(diary, null, 2)
  );
  return sections.join('\n\n');
}

function buildDiaryCoreAnalysisPrompt(input) {
  return [
    '你是一名经验丰富的中国建设工程监理工程师。',
    '请根据用户提供的今日施工原始信息，完成以下五项核心增强分析：',
    '1. 每个施工单位/分包单位/班组的施工总人数识别；',
    '2. 今日投入的施工机械识别；',
    '3. 今日实际施工情况分析；',
    '4. 监理日志正式表述补全；',
    '5. 监理人员当天应记录的巡视检查工作。',
    '',
    ANTI_HALLUCINATION_RULES,
    '',
    '【人员识别】' + PERSONNEL_CATEGORY_HINT,
    '用户只写了"现场施工人员共 XX 人"时，只识别总人数并提示"未明确各施工单位或班组人数，建议补充"。',
    '用户完全没提人数时，写"当前记录未提供施工人员数量，建议补充各施工单位、分包单位或班组当日投入人数。"',
    '',
    '【机械识别】' + MACHINERY_VOCAB_HINT,
    '【重要 扫描范围】必须扫描用户输入中所有描述(尤其"施工部位及施工状态"段落)里出现的施工机械,统一汇总到第二段"施工机械识别"。施工状态里写"投入塔吊 1 台、泵车 1 台"等具体台数,必须同样体现在机械识别清单里。',
    '用户只提机械名未提数量时，写"已识别机械：A、B、C。当前记录未提供具体数量，建议补充机械数量。"',
    '用户完全没提机械时，写"当前记录未提供施工机械投入情况，建议补充主要机械设备名称、数量及使用部位。"',
    '',
    '【输出格式】纯文本，不要 JSON，不要 Markdown 代码块；严格按以下六段顺序与中文标题输出：',
    '一、人员投入识别',
    '   按"1. XX单位：XX人"逐行列出，最后写"合计：XX人"（无法识别时按上面回退规则写）。',
    '二、施工机械识别',
    '   按"1. 机械名称：XX台"逐行列出（无法识别时按上面回退规则写）。',
    '三、今日施工情况分析',
    '   分析施工部位、施工内容、专业/工序、人员机械投入是否明确、施工是否正常推进、是否需要监理持续跟踪；不得虚构工程量、完成比例。',
    '四、监理日志表述补全',
    '   写一段可直接写入监理日志的正式文字，语言正式、客观、简洁，符合监理日志常用表达；缺人数/缺机械时按规则提示"建议补充……"。',
    '五、巡视检查工作',
    '   覆盖：施工部位/工序巡视、人员到岗与作业组织、机械使用情况、质量控制、安全文明施工、对发现问题的整改要求和后续复查；无依据的角度不要硬写。',
    '六、建议补充信息',
    '   列出当前输入中缺少但影响监理日志完整性的内容（人员、机械、部位、工序、验收、问题处理等）。',
    '',
    '【用户输入】',
    String(input || '').trim() || '（用户未提供任何输入）'
  ].join('\n');
}

async function readSseLines(response, onChunk, signal) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let full = '';
  while (true) {
    if (signal?.aborted) {
      try { await reader.cancel(); } catch {}
      throw new DOMException('aborted', 'AbortError');
    }
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      const delta = onChunk(line);
      if (delta) full += delta;
    }
  }
  if (buffer.trim()) {
    const delta = onChunk(buffer.trim());
    if (delta) full += delta;
  }
  return full;
}

async function callOllamaStream({ endpoint, model, prompt, signal, onDelta }) {
  const url = `${String(endpoint || 'http://127.0.0.1:11434').replace(/\/$/, '')}/api/chat`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'qwen2.5:7b',
      stream: true,
      messages: [
        { role: 'system', content: '你只返回 JSON。' },
        { role: 'user', content: prompt }
      ],
      format: 'json'
    }),
    signal
  });

  if (!response.ok) {
    throw new Error(`Ollama 请求失败：${response.status}`);
  }

  return readSseLines(response, (line) => {
    try {
      const obj = JSON.parse(line);
      const piece = obj.message?.content || obj.response || '';
      if (piece) onDelta(piece);
      return piece;
    } catch {
      return '';
    }
  }, signal);
}

async function callOpenAiCompatibleStream({ endpoint, apiKey, model, prompt, signal, onDelta }) {
  const baseUrl = String(endpoint || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey || ''}`,
      'HTTP-Referer': 'https://local.supervision-diary.app',
      'X-Title': 'Supervision Diary Generator'
    },
    body: JSON.stringify({
      model: model || 'openrouter/free',
      temperature: 0.2,
      stream: true,
      messages: [
        { role: 'system', content: '你是工程监理日志助手。你必须只返回 JSON，不要 Markdown。' },
        { role: 'user', content: prompt }
      ]
    }),
    signal
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI 请求失败：${response.status} ${text.slice(0, 120)}`);
  }

  return readSseLines(response, (line) => {
    if (!line.startsWith('data:')) return '';
    const data = line.slice(5).trim();
    if (data === '[DONE]') return '';
    try {
      const obj = JSON.parse(data);
      const piece = obj.choices?.[0]?.delta?.content || '';
      if (piece) onDelta(piece);
      return piece;
    } catch {
      return '';
    }
  }, signal);
}

const aiJobs = new Map();

async function runAiJob({ jobId, mode, diary, settings, webContents }) {
  const controller = new AbortController();
  aiJobs.set(jobId, controller);
  const send = (type, data) => {
    if (!webContents.isDestroyed()) {
      webContents.send('ai:event', { jobId, type, data });
    }
  };
  let rawText = '';
  try {
    const prompt = buildAiPrompt(mode, diary, settings?.glossary);
    const provider = settings?.provider || 'ollama';
    const onDelta = (piece) => send('chunk', piece);
    rawText =
      provider === 'ollama'
        ? await callOllamaStream({
            endpoint: settings?.endpoint,
            model: settings?.model,
            prompt,
            signal: controller.signal,
            onDelta
          })
        : await callOpenAiCompatibleStream({
            endpoint: settings?.endpoint,
            apiKey: settings?.apiKey,
            model: settings?.model,
            prompt,
            signal: controller.signal,
            onDelta
          });
    try {
      const parsed = extractJsonObject(rawText);
      send('done', { result: parsed, raw: rawText });
    } catch (e) {
      send('error', {
        message: e instanceof Error ? e.message : String(e),
        raw: rawText,
        code: (e && e.code) || 'AI_PARSE_FAIL'
      });
    }
  } catch (e) {
    if (controller.signal.aborted) {
      send('aborted', { message: '已取消' });
    } else {
      send('error', {
        message: e instanceof Error ? e.message : String(e),
        raw: rawText
      });
    }
  } finally {
    aiJobs.delete(jobId);
  }
}

ipcMain.handle('diary:export-docx', async (_event, payload) => {
  const defaultName = `个人监理日记${String(payload.date || '').replaceAll('-', '-') || '未命名'}.docx`;
  const result = await dialog.showSaveDialog({
    title: '导出监理日记',
    defaultPath: defaultName,
    filters: [{ name: 'Word 文档', extensions: ['docx'] }]
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const buffer = renderDiaryDocx(payload, getTemplatePath());
  fs.writeFileSync(result.filePath, buffer);
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle('diary:select-export-dir', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择日志导出目录',
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || !result.filePaths?.[0]) {
    return { canceled: true };
  }

  return { canceled: false, dir: result.filePaths[0] };
});

ipcMain.handle('diary:export-docx-to-dir', async (_event, payload) => {
  if (!payload?.exportDir) {
    throw new Error('请先选择导出目录');
  }

  fs.mkdirSync(payload.exportDir, { recursive: true });
  const safeDate = String(payload.date || '未命名').replace(/[\\/:*?"<>|]/g, '-');
  const filePath = path.join(payload.exportDir, `个人监理日记${safeDate}.docx`);
  const buffer = renderDiaryDocx(payload, getTemplatePath());
  fs.writeFileSync(filePath, buffer);
  return { canceled: false, filePath };
});

ipcMain.handle('diary:list', async () => {
  const store = readDiaryStore();
  return Object.values(store)
    .map((diary) => ({
      date: diary.date,
      weekday: diary.weekday,
      title: getDiaryTitle(diary),
      updatedAt: diary.updatedAt
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
});

ipcMain.handle('diary:save', async (_event, payload) => {
  if (!payload?.date) {
    throw new Error('保存失败：缺少日期');
  }

  const store = readDiaryStore();
  const now = new Date().toISOString();
  store[payload.date] = {
    ...payload,
    updatedAt: now
  };
  writeDiaryStore(store);
  return {
    ok: true,
    diary: store[payload.date],
    list: Object.values(store)
      .map((diary) => ({
        date: diary.date,
        weekday: diary.weekday,
        title: getDiaryTitle(diary),
        updatedAt: diary.updatedAt
      }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  };
});

ipcMain.handle('diary:get', async (_event, date) => {
  const store = readDiaryStore();
  return store[date] || null;
});

ipcMain.handle('diary:delete', async (_event, date) => {
  const store = readDiaryStore();
  delete store[date];
  writeDiaryStore(store);
  return { ok: true };
});

ipcMain.handle('diary:data-path', async () => getDiaryStorePath());

ipcMain.handle('weather:fetch', async (_event, payload) => fetchWeatherByCity(payload));

ipcMain.handle('ai:list-ollama-models', async (_event, endpoint) => {
  const base = String(endpoint || 'http://127.0.0.1:11434').replace(/\/$/, '');
  try {
    const response = await fetch(`${base}/api/tags`);
    if (!response.ok) {
      return { ok: false, error: `Ollama 响应 ${response.status}`, models: [] };
    }
    const data = await response.json();
    const models = Array.isArray(data?.models)
      ? data.models.map((m) => m.name).filter(Boolean)
      : [];
    return { ok: true, models };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), models: [] };
  }
});

ipcMain.handle('ai:start', async (event, payload) => {
  const jobId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  runAiJob({
    jobId,
    mode: payload?.mode,
    diary: payload?.diary,
    settings: payload?.settings,
    webContents: event.sender
  });
  return jobId;
});

ipcMain.handle('ai:abort', async (_event, jobId) => {
  const controller = aiJobs.get(jobId);
  if (controller) {
    controller.abort();
    return { ok: true };
  }
  return { ok: false };
});

app.whenReady().then(() => {
  createAppMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
