const fs = require('fs');
const path = require('path');

// Корень проекта (на уровень выше папки scripts)
const ROOT = path.join(__dirname, '..');

// Общие данные (не зависят от уровня)
const COMMON_JSON = {
  ORGS: "data/common/organizations.json",
  CONTACTS: "data/common/contacts.json",
  EMPLOYEES: "data/common/employees.json",
  EMPLOYEES_L3: "data/common/employees-l3.json",
  COMMENTS_L2: "data/common/comments-l2.json",
  TAX: "data/common/taxonomy.json",
  MATRIX: "data/common/matrix.json",
  PROBLEM_METHODS: "data/common/problem-methods.json",
  ARCHIVE_INCIDENTS: "data/common/archive-incidents.json",
  PROBLEMS: "data/problems.json",
  KB_L3: "data/kb-l3.json"
};

// Реестр уровней — единственная точка, куда добавляется новый уровень
const LEVELS_INDEX = "data/levels/index.json";

const out = {};
for (const [key, file] of Object.entries(COMMON_JSON)) {
  out[key] = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
}

// --- Загрузка уровней из манифестов ---
const levelIndex = JSON.parse(fs.readFileSync(path.join(ROOT, LEVELS_INDEX), 'utf8'));
const levelManifests = [];
const levelData = {};

for (const manifestFile of levelIndex.levels) {
  const manifestPath = path.join(ROOT, 'data/levels', manifestFile);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const tickets = JSON.parse(fs.readFileSync(path.join(ROOT, manifest.tickets), 'utf8'));
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, manifest.schema), 'utf8'));

  // Backward-compat: TICKETS / TICKETS_LN и SCHEMA_LN остаются как глобалы
  // (используются autotests.js — отдельный трек)
  const ticketsKey = manifest.id === 1 ? 'TICKETS' : `TICKETS_L${manifest.id}`;
  const schemaKey = `SCHEMA_L${manifest.id}`;
  out[ticketsKey] = tickets;
  out[schemaKey] = schema;

  // Метаданные уровня (без tickets/schema — они в LEVEL_DATA)
  levelManifests.push({
    id: manifest.id,
    title: manifest.title,
    desc: manifest.desc,
    workflow: manifest.workflow || null,
    queue: manifest.queue || null,
    intro: manifest.intro || null,
    workTitle: manifest.workTitle || null
  });
  levelData[manifest.id] = { tickets, schema };
}
levelManifests.sort((a, b) => a.id - b.id);

// --- Валидация контракта options (B.5) ---
function validateSchemaOptions(name, schema) {
  if (!schema || !Array.isArray(schema.fields)) return;
  const walk = (fields) => {
    for (const f of fields) {
      if (!f) continue;
      if (f.type === "composite" && Array.isArray(f.fields)) { walk(f.fields); continue; }
      if (f.options === undefined) continue;
      if (!Array.isArray(f.options)) {
        console.warn(`⚠ ${name}: field "${f.id}" options is not an array`);
        continue;
      }
      f.options.forEach((o, i) => {
        if (typeof o === "string") return;
        if (!o || typeof o !== "object" || !("value" in o)) {
          console.warn(`⚠ ${name}: field "${f.id}" option[${i}] is neither a string nor {value,label}:`, o);
        }
      });
    }
  };
  walk(schema.fields);
}
for (const [key, schema] of Object.entries(out)) {
  if (key.startsWith("SCHEMA_")) validateSchemaOptions(key, schema);
}

// --- Генерация bundle ---
const banner = "// АВТОГЕНЕРАЦИЯ! Не редактируйте этот файл руками. Меняйте JSON в папке data/ и запускайте npm run build\n";
let code = banner;

for (const [key, data] of Object.entries(out)) {
  code += `var ${key} = ${JSON.stringify(data, null, 2)};\n\n`;
}

// LEVELS — массив манифестов уровней
code += `var LEVELS = ${JSON.stringify(levelManifests, null, 2)};\n\n`;

// LEVEL_DATA — ссылки на глобалы, без дублирования
code += "var LEVEL_DATA = {\n";
for (const [id] of Object.entries(levelData)) {
  const ticketsKey = String(id) === '1' ? 'TICKETS' : `TICKETS_L${id}`;
  code += `  ${id}: { tickets: ${ticketsKey}, schema: SCHEMA_L${id} },\n`;
}
code += "};\n\n";

const outDir = path.join(ROOT, 'js');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'data-bundle.js');
fs.writeFileSync(outPath, code, 'utf8');
console.log(`✅ Успешно собран: ${outPath}`);
