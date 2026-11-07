const fs = require('fs');
const path = require('path');

// Корень проекта (на уровень выше папки scripts)
const ROOT = path.join(__dirname, '..');

const JSON_FILES = {
  ORGS: "data/common/organizations.json",
  CONTACTS: "data/common/contacts.json",
  EMPLOYEES: "data/common/employees.json",
  EMPLOYEES_L3: "data/common/employees-l3.json",
  COMMENTS_L2: "data/common/comments-l2.json",
  TAX: "data/common/taxonomy.json",
  MATRIX: "data/common/matrix.json",
  PROBLEM_METHODS: "data/common/problem-methods.json",
  ARCHIVE_INCIDENTS: "data/common/archive-incidents.json",
  TICKETS: "data/tickets/l1.json",
  TICKETS_L2: "data/tickets/l2.json",
  TICKETS_L3: "data/tickets/l3.json",
  PROBLEMS: "data/problems.json",
  KB_L3: "data/kb-l3.json",
  SCHEMA_L1: "data/schemas/card-l1.json",
  SCHEMA_L2: "data/schemas/card-l2.json",
  SCHEMA_L3: "data/schemas/card-l3.json"
};

const out = {};
for (const [key, file] of Object.entries(JSON_FILES)) {
  const fullPath = path.join(ROOT, file);
  out[key] = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

// --- Валидация контракта options в схемах (B.5) ---
// Разрешены: массив строк или массив {value,label}. Всё остальное -> warning.
function validateSchemaOptions(name, schema) {
  if (!schema || !Array.isArray(schema.fields)) return;
  const walk = (fields) => {
    for (const f of fields) {
      if (!f) continue;
      if (f.type === "composite" && Array.isArray(f.fields)) {
        walk(f.fields);
        continue;
      }
      if (f.options === undefined) continue;
      if (!Array.isArray(f.options)) {
        console.warn(`⚠ ${name}: field "${f.id}" options is not an array`);
        continue;
      }
      f.options.forEach((o, i) => {
        if (typeof o === "string") return;
        if (!o || typeof o !== "object" || !("value" in o)) {
          console.warn(
            `⚠ ${name}: field "${f.id}" option[${i}] is neither a string nor {value,label}:`,
            o
          );
        }
      });
    }
  };
  walk(schema.fields);
}

// Итерируем по всем загруженным схемам, а не по хардкоженному списку.
// Сегодня это SCHEMA_L1/L2/L3, завтра — SCHEMA_L4+ подхватится автоматически,
// как только появится в JSON_FILES (или в манифесте после Commit D).
for (const [key, schema] of Object.entries(out)) {
  if (key.startsWith("SCHEMA_")) {
    validateSchemaOptions(key, schema);
  }
}
// --- /Валидация контракта options ---

const banner = "// АВТОГЕНЕРАЦИЯ! Не редактируйте этот файл руками. Меняйте JSON в папке data/ и запускайте npm run build\n";
let code = banner;

// Генерируем объявление глобальных переменных (window.ORGS = ... и т.д.)
for (const [key, data] of Object.entries(out)) {
  code += `var ${key} = ${JSON.stringify(data, null, 2)};\n\n`;
}

const outDir = path.join(ROOT, 'js');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outPath = path.join(outDir, 'data-bundle.js');
fs.writeFileSync(outPath, code, 'utf8');
console.log(`✅ Успешно собран: ${outPath}`);
