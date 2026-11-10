'use strict';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isLocalizedText(value) {
  return typeof value === 'string' || (isRecord(value) && Object.values(value).every(item => item == null || typeof item === 'string'));
}

function hasProjectName(value) {
  if (!isLocalizedText(value)) return false;
  const names = typeof value === 'string' ? [value] : Object.values(value);
  return names.some(name => typeof name === 'string' && name.trim());
}

function isValidLink(value, allowedProtocols, required = false) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f\\]/.test(value)) return false;
  const url = value.trim();
  if (!url) return !required;
  if (/^(?:https?:\/\/|\/\/)/i.test(url)) {
    try {
      return Boolean(new URL(url.startsWith('//') ? `https:${url}` : url).hostname);
    } catch {
      return false;
    }
  }
  const scheme = url.match(/^([a-z][a-z0-9+.-]*):/i);
  return !scheme || allowedProtocols.includes(scheme[1].toLowerCase());
}

function validateData(name, value) {
  const errors = [];
  function check(condition, field, message) {
    if (!condition) errors.push(`${field}: ${message}`);
    return Boolean(condition);
  }
  function checkTextFields(item, prefix, names) {
    for (const key of names) {
      if (item[key] != null) check(isLocalizedText(item[key]), `${prefix}.${key}`, 'expected text or language-keyed text.');
    }
  }
  if (name === 'projects') {
    if (!check(Array.isArray(value), name, 'expected a list.')) return errors;
    value.forEach((item, i) => {
      const prefix = `projects[${i}]`;
      if (!check(isRecord(item), prefix, 'expected an object.')) return;
      check(hasProjectName(item.name), `${prefix}.name`, 'expected a nonempty project name.');
      checkTextFields(item, prefix, ['kind', 'status', 'description']);
      if (item.tags != null) check(Array.isArray(item.tags) && item.tags.every(isLocalizedText), `${prefix}.tags`, 'expected a list of text values.');
      for (const key of ['source', 'demo']) {
        if (item[key] != null) check(isValidLink(item[key], []), `${prefix}.${key}`, 'expected a local path or HTTP(S) URL.');
      }
    });
    return errors;
  }

  if (!check(isRecord(value), name, 'expected an object.')) return errors;
  if (!check(value.groups == null || Array.isArray(value.groups), 'friends.groups', 'expected a list.')) return errors;
  checkTextFields(value, name, ['intro']);
  if (value.apply != null && check(isRecord(value.apply), 'friends.apply', 'expected an object.')) {
    checkTextFields(value.apply, 'friends.apply', ['description']);
  }
  const groups = value.groups ?? [];
  groups.forEach((group, i) => {
    const prefix = `friends.groups[${i}]`;
    if (!check(isRecord(group) && Array.isArray(group.items), prefix, 'expected an object with an items list.')) return;
    checkTextFields(group, prefix, ['name', 'description']);
    group.items.forEach((item, j) => {
      const field = `${prefix}.items[${j}]`;
      if (!check(isRecord(item), field, 'expected an object.')) return;
      check(isValidLink(item.url, ['mailto', 'tel'], true), `${field}.url`, 'expected a local path, HTTP(S), mailto or tel URL.');
      checkTextFields(item, field, ['description']);
      if (item.name != null) check(typeof item.name === 'string', `${field}.name`, 'expected text.');
      if (item.avatar != null) check(isValidLink(item.avatar, ['data']), `${field}.avatar`, 'expected an image path or URL.');
      if (item.tags != null) check(Array.isArray(item.tags) && item.tags.every(tag => typeof tag === 'string'), `${field}.tags`, 'expected a list of text values.');
    });
  });
  return errors;
}

module.exports = validateData;
