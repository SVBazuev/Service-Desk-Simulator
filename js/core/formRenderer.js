/**
 * formRenderer.js — генератор форм на основе JSON-схем.
 */
var FormRenderer = {
  /**
   * Рендерит форму в указанный контейнер.
   * @param {string} containerId - ID элемента, куда вставлять форму.
   * @param {Object} schema - Схема (SCHEMA_L1 или SCHEMA_L2).
   * @param {string} prefix - Префикс для ID генерируемых полей (по умолчанию "card-").
   */
  render: function(containerId, schema, prefix = "card-") {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    for (const field of schema.fields) {
      //TODO пока пропускаем поле версий, так как для него нужен сложный кастомный UI
      if (field.type === 'versions') continue;

      const id = prefix + field.id;
      const label = document.createElement('label');
      label.className = 'form-field' + (field.type === 'textarea' ? ' full' : '');

      const span = document.createElement('span');
      span.className = 'form-label';
      span.textContent = field.label;
      label.appendChild(span);

      let input;
      if (field.type === 'text') {
        input = document.createElement('input');
        input.type = 'text';
      } else if (field.type === 'textarea') {
        input = document.createElement('textarea');
      } else if (field.type === 'select') {
        input = document.createElement('select');
      }

      input.id = id;
      input.name = field.id;
      if (field.required) input.required = true;

      // Если у поля есть статические опции в схеме (например, Важность, Срочность)
      if (field.type === 'select' && field.options) {
        const opts = field.options.map(opt =>
          typeof opt === 'string' ? { value: opt, label: opt } : opt
        );
        fillSelect(input, opts);
      }

      label.appendChild(input);
      container.appendChild(label);
    }
  }
};
