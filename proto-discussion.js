(function (global) {
  'use strict';

  var REFRESH_MS = 750;
  var REQUIRED_METHODS = ['threadsAt', 'loadDetail', 'startThread', 'replyTo', 'resolveThread'];

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function clean(value) {
    return String(value == null ? '' : value).trim();
  }

  function commentsPageUrl() {
    var target = new URL('comments.html', global.location.href);
    target.search = global.location.search;
    return target.href;
  }

  function formattedTime(value) {
    var date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
  }

  function threadKey(thread) {
    return [
      thread && thread.id,
      thread && thread.status,
      thread && thread.updatedAt,
      Array.isArray(thread && thread.messages) ? thread.messages.length : -1,
    ].join(':');
  }

  function messageView(message) {
    var item = el('article', 'pd-message');
    var author = message && message.author || {};
    var byline = clean(author.name || author.email) || 'Reviewer';
    var time = formattedTime(message && message.createdAt);
    item.appendChild(el('small', 'pd-byline', byline + (time ? ' · ' + time : '')));
    item.appendChild(el('p', 'pd-message-body', message && message.body || ''));
    return item;
  }

  function signInView() {
    var prompt = el('p', 'pd-signin');
    var link = el('a', '', 'Sign in on the comments page');
    link.href = commentsPageUrl();
    prompt.appendChild(link);
    prompt.appendChild(document.createTextNode(' to start or reply to a discussion.'));
    return prompt;
  }

  function composer(label, placeholder, submitLabel, action, afterSubmit) {
    var form = el('form', 'pd-composer');
    var fieldId = 'pd-field-' + Math.random().toString(36).slice(2);
    var fieldLabel = el('label', 'pd-label', label);
    fieldLabel.htmlFor = fieldId;
    var textarea = document.createElement('textarea');
    textarea.id = fieldId;
    textarea.rows = 3;
    textarea.placeholder = placeholder;
    textarea.required = true;
    var actions = el('div', 'pd-actions');
    var submit = el('button', 'pd-submit', submitLabel);
    submit.type = 'submit';
    actions.appendChild(submit);
    var error = el('p', 'pd-error');
    error.hidden = true;
    form.append(fieldLabel, textarea, actions, error);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var body = clean(textarea.value);
      if (!body) return;
      submit.disabled = true;
      error.hidden = true;
      Promise.resolve(action(body))
        .then(function () {
          textarea.value = '';
          if (afterSubmit) afterSubmit();
        })
        .catch(function () {
          error.textContent = 'The comment could not be saved. Check reviewer access and try again.';
          error.hidden = false;
        })
        .finally(function () { submit.disabled = false; });
    });
    return form;
  }

  function mount(layer) {
    if (!layer || REQUIRED_METHODS.some(function (name) { return typeof layer[name] !== 'function'; })) return null;

    var targets = Array.prototype.slice.call(document.querySelectorAll('[data-c]'));
    if (!targets.length) return null;

    var detailRequests = new Set();
    var disposed = false;
    var highlightedThread = null;
    var records = targets.map(function (target) {
      var section = el('section', 'pd-discussion');
      section.setAttribute('aria-label', 'Discussion');
      section.dataset.discussionFor = target.getAttribute('data-c');
      target.appendChild(section);
      return { target: target, section: section, signature: null, notice: '' };
    });

    function requestDetail(record, thread) {
      if (!thread || !thread.id || Array.isArray(thread.messages)) return;
      var key = threadKey(thread);
      if (detailRequests.has(key)) return;
      detailRequests.add(key);
      Promise.resolve(layer.loadDetail(thread))
        .catch(function () { record.notice = 'Thread details could not be loaded.'; })
        .finally(function () {
          if (!disposed) refresh(true);
        });
    }

    function resolveButton(record, thread) {
      var button = el('button', 'pd-resolve', 'Resolve');
      button.type = 'button';
      button.addEventListener('click', function () {
        button.disabled = true;
        record.notice = '';
        Promise.resolve(layer.resolveThread(thread))
          .then(function () { record.notice = 'Thread resolved.'; })
          .catch(function () { record.notice = 'This thread could not be resolved.'; })
          .finally(function () {
            button.disabled = false;
            if (!disposed) refresh(true);
          });
      });
      return button;
    }

    function threadView(record, thread, index) {
      var view = el('article', 'pd-thread' + (thread.status === 'resolved' ? ' is-resolved' : ''));
      view.dataset.threadId = thread.id || '';

      var head = el('header', 'pd-thread-head');
      var link = el('a', 'pd-thread-link', 'Thread ' + (index + 1));
      link.href = '#c=' + encodeURIComponent(thread.id || '');
      var status = el('span', 'pd-status', thread.status === 'resolved' ? 'Resolved' : 'Open');
      head.append(link, status);
      if (thread.status !== 'resolved') head.appendChild(resolveButton(record, thread));
      view.appendChild(head);

      if (Array.isArray(thread.messages)) {
        var messages = el('div', 'pd-messages');
        if (thread.messages.length) {
          thread.messages.forEach(function (message) { messages.appendChild(messageView(message)); });
        } else {
          messages.appendChild(el('p', 'pd-empty', 'No messages in this thread.'));
        }
        view.appendChild(messages);
      } else {
        view.appendChild(el('p', 'pd-loading', 'Loading thread…'));
        requestDetail(record, thread);
      }

      if (thread.status !== 'resolved') {
        view.appendChild(composer(
          'Reply',
          'Write a reply',
          'Reply',
          function (body) { return layer.replyTo(thread, body); },
          function () { record.notice = 'Reply saved.'; refresh(true); },
        ));
      }
      return view;
    }

    function render(record, threads, signedIn, delivered) {
      var section = record.section;
      section.textContent = '';
      var head = el('header', 'pd-head');
      head.appendChild(el('h4', 'pd-title', 'Discussion'));
      head.appendChild(el('span', 'pd-count', threads.length + (threads.length === 1 ? ' thread' : ' threads')));
      section.appendChild(head);

      if (record.notice) section.appendChild(el('p', 'pd-notice', record.notice));
      if (!signedIn) {
        section.appendChild(signInView());
        return;
      }
      if (!delivered) {
        section.appendChild(el('p', 'pd-loading', 'Loading discussion…'));
        return;
      }

      if (threads.length) {
        var list = el('div', 'pd-list');
        threads.forEach(function (thread, index) { list.appendChild(threadView(record, thread, index)); });
        section.appendChild(list);
      } else {
        section.appendChild(el('p', 'pd-empty', 'No threads yet.'));
      }

      section.appendChild(composer(
        'New thread',
        'What should change?',
        'Start thread',
        function (body) { return layer.startThread(record.target, body); },
        function () { record.notice = 'Thread started.'; refresh(true); },
      ));
    }

    function focusDeepLink() {
      var id = new URLSearchParams(global.location.hash.replace(/^#/, '')).get('c');
      if (!id || id === highlightedThread) return;
      var match = Array.prototype.slice.call(document.querySelectorAll('.pd-thread[data-thread-id]'))
        .find(function (thread) { return thread.dataset.threadId === id; });
      if (!match) return;
      highlightedThread = id;
      match.classList.add('is-highlighted');
      match.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function refresh(force) {
      records.forEach(function (record) {
        var threads;
        try {
          threads = layer.threadsAt(record.target) || [];
        } catch (error) {
          threads = [];
          record.notice = 'Discussion could not be loaded.';
        }
        var signedIn = Boolean(layer.user);
        var delivered = Boolean(layer.threadsDelivered);
        var signature = [signedIn, delivered, record.notice]
          .concat(threads.map(threadKey))
          .join('|');
        if (force || signature !== record.signature) {
          record.signature = signature;
          render(record, threads, signedIn, delivered);
        }
      });
      focusDeepLink();
    }

    refresh(true);
    var timer = global.setInterval(refresh, REFRESH_MS);
    global.addEventListener('hashchange', focusDeepLink);

    return {
      refresh: function () { refresh(true); },
      destroy: function () {
        disposed = true;
        global.clearInterval(timer);
        global.removeEventListener('hashchange', focusDeepLink);
        records.forEach(function (record) { record.section.remove(); });
      },
    };
  }

  global.protoDiscussion = { mount: mount };
})(window);
