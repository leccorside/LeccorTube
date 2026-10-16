// Testa a camada i18n_dom.js fora do navegador.
// Uso: node tools/i18n/try.cjs [lang] "texto 1" "texto 2" ...
const path = require('path');
const lang = process.argv[2] || 'pt-BR';
global.window = { I18N: { getLang: () => lang }, alert() {}, confirm() {}, prompt() {} };
global.document = { body: null, addEventListener() {} };
global.MutationObserver = class { observe() {} };
global.NodeFilter = {};
require(path.resolve(__dirname, '../../static/i18n_dict.js'));
require(path.resolve(__dirname, '../../static/i18n_dom.js'));
for (const s of process.argv.slice(3)) console.log(JSON.stringify(s), '=>', JSON.stringify(window.I18N_DOM.translate(s)));
module.exports = window.I18N_DOM;
