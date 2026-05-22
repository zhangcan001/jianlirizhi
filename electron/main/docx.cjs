const fs = require('fs');
const PizZip = require('pizzip');

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function textToWordRuns(value, fallback = '无。') {
  const content = value === undefined || value === null || value === '' ? fallback : value;
  const lines = String(content).split(/\r?\n/);

  return lines
    .map((line, index) => {
      const text = `<w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`;
      return index === 0 ? text : `<w:r><w:br/></w:r>${text}`;
    })
    .join('');
}

function replaceCellByExactText(documentXml, oldText, newText) {
  const pattern = new RegExp(`(<w:t[^>]*>)${escapeRegExp(oldText)}(<\\/w:t>)`, 'g');
  return documentXml.replace(pattern, `$1${escapeXml(newText)}$2`);
}

function replaceCellContent(cellXml, value, fallback) {
  const paragraphPattern = /(<w:p[\s\S]*?>)([\s\S]*?)(<\/w:p>)/;
  if (paragraphPattern.test(cellXml)) {
    return cellXml.replace(paragraphPattern, (_match, open, _body, close) => `${open}${textToWordRuns(value, fallback)}${close}`);
  }

  return cellXml.replace('</w:tc>', `<w:p>${textToWordRuns(value, fallback)}</w:p></w:tc>`);
}

function replaceTableCell(documentXml, rowIndex, cellIndex, value, fallback = '无。') {
  let currentRow = -1;

  return documentXml.replace(/<w:tr[\s\S]*?<\/w:tr>/g, (rowXml) => {
    currentRow += 1;
    if (currentRow !== rowIndex) {
      return rowXml;
    }

    let currentCell = -1;
    return rowXml.replace(/<w:tc[\s\S]*?<\/w:tc>/g, (cellXml) => {
      currentCell += 1;
      return currentCell === cellIndex ? replaceCellContent(cellXml, value, fallback) : cellXml;
    });
  });
}

function renderDiaryDocx(data, templatePath) {
  const content = fs.readFileSync(templatePath);
  const zip = new PizZip(content);
  let documentXml = zip.file('word/document.xml').asText();

  const date = new Date(`${data.date}T00:00:00`);
  const dateText = Number.isNaN(date.getTime())
    ? data.date
    : `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月${String(date.getDate()).padStart(2, '0')}日`;

  documentXml = replaceTableCell(documentXml, 0, 2, dateText);
  documentXml = replaceTableCell(documentXml, 0, 3, data.weekday || '');
  documentXml = replaceTableCell(documentXml, 2, 0, `上午 ${data.weatherMorning || '晴'}`);
  documentXml = replaceTableCell(documentXml, 2, 1, `下午 ${data.weatherAfternoon || '晴'}`);
  documentXml = replaceTableCell(documentXml, 2, 3, data.temperature || '');
  documentXml = replaceTableCell(documentXml, 2, 4, data.humidity || '');
  documentXml = replaceTableCell(documentXml, 2, 5, data.windDirection || '');
  documentXml = replaceTableCell(documentXml, 2, 6, data.windPower || '');

  documentXml = replaceTableCell(documentXml, 4, 1, data.constructionStatus);
  documentXml = replaceTableCell(documentXml, 5, 1, data.contractorPersonnel);
  documentXml = replaceTableCell(documentXml, 6, 1, data.machinery);
  documentXml = replaceTableCell(documentXml, 8, 1, data.inspectionWork);
  documentXml = replaceTableCell(documentXml, 9, 1, data.materialAcceptance);
  documentXml = replaceTableCell(documentXml, 10, 1, data.acceptanceWork);
  documentXml = replaceTableCell(documentXml, 11, 1, data.standingWork);
  documentXml = replaceTableCell(documentXml, 12, 1, data.meeting);
  documentXml = replaceTableCell(documentXml, 13, 1, data.internalWork);

  documentXml = replaceTableCell(documentXml, 15, 0, data.issuesAndActions);
  documentXml = replaceTableCell(documentXml, 17, 0, data.otherMatters);
  documentXml = replaceTableCell(documentXml, 21, 0, data.chiefEngineerComments, '');
  documentXml = replaceCellByExactText(documentXml, '日记填写人：张灿', `日记填写人：${data.writer || '张灿'}`);

  zip.file('word/document.xml', documentXml);
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = {
  renderDiaryDocx
};
