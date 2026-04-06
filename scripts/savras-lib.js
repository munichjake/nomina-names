/**
 * SavrasLib - Anonymous usage telemetry for FoundryVTT modules.
 *
 * Drop this file into your module and instantiate at load time.
 * Hooks are registered automatically — no manual init() calls needed.
 * Then call send(viewMode) whenever a tracked view is opened.
 *
 * Extends the telemetry pattern with support for custom detail payloads
 * (stored as JSONB on the backend) and optional startup messages.
 *
 * No dependencies. No personal data. Fully opt-out.
 */

export class SavrasLib {

  /** @type {string} */             #moduleId;
  /** @type {string} */             #telemetryUrl;
  /** @type {boolean} */            #consentDefault;
  /** @type {string|null} */        #startupMessage;
  /** @type {Set<string>} */        #sentThisSession = new Set();
  /** @type {boolean} */            #popupShownThisSession = false;
  /** @type {string|undefined} */   #contentLanguage;

  /**
   * @param {object}  opts
   * @param {string}  opts.moduleId          FoundryVTT module ID
   * @param {string}  opts.telemetryUrl      Backend endpoint URL
   * @param {boolean} [opts.consentDefault=true]  Telemetry on by default?
   * @param {string|null} [opts.startupMessage=null]  Optional message logged on init()
   */
  constructor({ moduleId, telemetryUrl, consentDefault = true, startupMessage = null }) {
    this.#moduleId       = moduleId;
    this.#telemetryUrl   = telemetryUrl;
    this.#consentDefault = consentDefault;
    this.#startupMessage = startupMessage;

    // Auto-register Foundry hooks — just instantiate and forget.
    Hooks.once('init',  () => this.registerSettings());
    Hooks.once('ready', () => this.init());
  }

  /* -------------------------------------------------- */
  /*  Public API                                        */
  /* -------------------------------------------------- */

  /**
   * Register FoundryVTT module settings.
   * Call once inside `Hooks.once('init')` so settings exist before the ready hook.
   */
  registerSettings() {
    try {
      game.settings.register(this.#moduleId, 'telemetryEnabled', {
        name: 'Anonymous Usage Statistics',
        hint: 'When enabled, this module sends anonymous usage statistics '
            + '(no personal data) to help the developer understand which features '
            + 'are used. You can opt out at any time by unchecking this box. '
            + 'Data collected: Foundry version, game system, module version, '
            + 'language settings, and which view was opened. '
            + 'No IP addresses or personal information are stored.\n\n'
            + 'Wenn aktiviert, sendet dieses Modul anonyme Nutzungsstatistiken '
            + '(keine persoenlichen Daten), um dem Entwickler zu helfen zu verstehen, '
            + 'welche Funktionen genutzt werden. Du kannst jederzeit abwaehlen, indem '
            + 'du dieses Kaestchen deaktivierst.',
        scope:   'world',
        config:  true,
        type:    Boolean,
        default: this.#consentDefault,
      });

      game.settings.register(this.#moduleId, 'telemetryInstanceId', {
        scope:   'world',
        config:  false,
        type:    String,
        default: '',
      });

      game.settings.register(this.#moduleId, 'telemetryDismissedMessages', {
        scope:   'world',
        config:  false,
        type:    String,
        default: '{}',
      });
    } catch (err) {
      console.debug(`SavrasLib | ${this.#moduleId} | registerSettings failed:`, err);
    }
  }

  /**
   * Runtime initialization. Call once inside `Hooks.once('ready')`.
   * Generates instance ID if missing, logs startup message, and sends a startup ping.
   */
  init() {
    try {
      // Lazily generate a stable instance ID on first access.
      if (!game.settings.get(this.#moduleId, 'telemetryInstanceId')) {
        game.settings.set(this.#moduleId, 'telemetryInstanceId', crypto.randomUUID());
      }

      if (this.#startupMessage) {
        console.log(`SavrasLib | ${this.#moduleId} | ${this.#startupMessage}`);
      }

      // Send startup telemetry ping
      this.send('startup');
    } catch (err) {
      console.debug(`SavrasLib | ${this.#moduleId} | Init failed:`, err);
    }
  }

  /**
   * Check if a message has been dismissed (by message ID, stored per module version).
   * @param {number} messageId
   * @returns {boolean}
   */
  #isMessageDismissed(messageId) {
    try {
      const raw = game.settings.get(this.#moduleId, 'telemetryDismissedMessages');
      const dismissed = JSON.parse(raw || '{}');
      const mod = game.modules.get(this.#moduleId);
      const currentVersion = mod?.version ?? 'unknown';
      // Dismissed if stored version matches current module version
      return dismissed[messageId] === currentVersion;
    } catch {
      return false;
    }
  }

  /**
   * Mark one or more messages as dismissed for the current module version.
   * @param {number|number[]} messageIds  Single ID or array of IDs
   */
  #dismissMessages(messageIds) {
    try {
      const ids = Array.isArray(messageIds) ? messageIds : [messageIds];
      const raw = game.settings.get(this.#moduleId, 'telemetryDismissedMessages');
      const dismissed = JSON.parse(raw || '{}');
      const mod = game.modules.get(this.#moduleId);
      const version = mod?.version ?? 'unknown';
      for (const id of ids) dismissed[id] = version;
      game.settings.set(this.#moduleId, 'telemetryDismissedMessages', JSON.stringify(dismissed));
    } catch (err) {
      console.debug(`SavrasLib | ${this.#moduleId} | Failed to dismiss messages:`, err);
    }
  }

  /**
   * Send a message telemetry event (shown / interaction) to the backend.
   * @param {string} eventType   'shown' or 'interaction'
   * @param {number} messageId
   * @param {object} [extra]     Additional fields for interactions (buttonLabel, dismissed, durationMs)
   */
  #sendMessageTelemetry(eventType, messageId, extra = {}) {
    try {
      const mod = game.modules.get(this.#moduleId);
      const payload = {
        type:           eventType,
        messageId,
        instanceId:     game.settings.get(this.#moduleId, 'telemetryInstanceId'),
        moduleId:       this.#moduleId,
        moduleVersion:  mod?.version ?? 'unknown',
        userRole:       game.user.role,
        foundryVersion: game.version,
        systemId:       game.system.id,
        ...extra,
      };
      const url = this.#telemetryUrl.replace(/\/telemetry\/?$/, '/message-telemetry');
      fetch(url, {
        method:    'POST',
        headers:   { 'Content-Type': 'application/json' },
        body:      JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Non-critical — silently ignore
    }
  }

  /**
   * Display a single FoundryVTT dialog popup with merged content from multiple messages.
   * Messages are shown newest first. All unique buttons across messages are collected.
   *
   * @param {object[]} messages  Array of message objects (already filtered, newest first)
   */
  #showPopup(messages) {
    try {
      if (!messages.length) return;

      const checkboxId = `savras-dismiss-${this.#moduleId}`;
      const messageIds = messages.map((m) => m.id);
      const shownAt = Date.now();

      // Send 'shown' telemetry for each message
      for (const id of messageIds) {
        this.#sendMessageTelemetry('shown', id);
      }

      // Use the first (newest) message's title as the dialog title
      const dialogTitle = messages[0].title;

      // Merge content: each message gets its own section, newest first
      const mergedContent = messages.map((m) => {
        const heading = messages.length > 1 ? `<h3 style="margin:0.5em 0 0.3em;">${m.title}</h3>` : '';
        return `${heading}<div>${m.content}</div>`;
      }).join('<hr style="border:0; border-top:1px solid rgba(128,128,128,0.3); margin:0.8em 0;">');

      // Collect unique buttons across all messages (deduplicate by label+url)
      const seenButtons = new Set();
      const allButtons = [];
      for (const m of messages) {
        const btnList = Array.isArray(m.buttons) && m.buttons.length > 0 ? m.buttons : [{ label: 'OK' }];
        for (const btn of btnList) {
          const key = `${btn.label || 'OK'}|${btn.url || ''}`;
          if (!seenButtons.has(key)) {
            seenButtons.add(key);
            allButtons.push(btn);
          }
        }
      }

      // Build dialog buttons
      const dialogButtons = {};
      allButtons.forEach((btn, i) => {
        dialogButtons[`btn${i}`] = {
          label: btn.label || 'OK',
          callback: (html) => {
            const checkbox = html.find ? html.find(`#${checkboxId}`)[0] : html.querySelector(`#${checkboxId}`);
            const isDismissed = checkbox?.checked ?? false;
            const durationMs = Date.now() - shownAt;
            if (isDismissed) {
              this.#dismissMessages(messageIds);
            }
            for (const id of messageIds) {
              this.#sendMessageTelemetry('interaction', id, {
                buttonLabel: btn.label || 'OK',
                dismissed: isDismissed,
                durationMs,
              });
            }
            if (btn.url) window.open(btn.url, '_blank');
          },
        };
      });

      new Dialog({
        title: dialogTitle,
        content: `
          <div>${mergedContent}</div>
          <hr>
          <label style="display:flex; align-items:center; gap:0.4em; cursor:pointer; font-size:0.9em; opacity:0.85;">
            <input type="checkbox" id="${checkboxId}">
            Don't show this again until the next update
          </label>`,
        buttons: dialogButtons,
        default: 'btn0',
      }).render(true);
    } catch (err) {
      console.debug(`SavrasLib | ${this.#moduleId} | Failed to show popup:`, err);
    }
  }

  /** Set the content/generation language so it can be included in pings. */
  setContentLanguage(lang) {
    this.#contentLanguage = lang;
  }

  /**
   * Send a telemetry ping for the given view mode.
   * Only fires once per session per viewMode and only for GMs.
   *
   * @param {string} viewMode   Identifier for the view that was opened
   * @param {object} [options={}]
   * @param {string} [options.contentLanguage]  Override content language for this call
   * @param {object} [options.details]          Module-specific custom data, stored as JSONB (e.g. { feature: 'npc-gen', count: 5 })
   * @returns {Promise<{title: string, content: string}|null>} Message object if present, otherwise null
   */
  async send(viewMode, options = {}) {
    try {
      if (!game.settings.get(this.#moduleId, 'telemetryEnabled')) return null;
      if (!(game.user?.isGM || game.user?.role >= 4)) return null;
      if (this.#sentThisSession.has(viewMode)) return null;
      this.#sentThisSession.add(viewMode);

      const mod = game.modules.get(this.#moduleId);

      // Build details: merge viewMode, contentLanguage, and caller-provided details.
      const details = {};
      const cl = options.contentLanguage ?? this.#contentLanguage;
      if (cl) details.contentLanguage = cl;
      if (viewMode) details.viewMode = viewMode;
      if (options.details != null && typeof options.details === 'object' && !Array.isArray(options.details)) {
        Object.assign(details, options.details);
      }

      const payload = {
        instanceId:       game.settings.get(this.#moduleId, 'telemetryInstanceId'),
        moduleId:         this.#moduleId,
        foundryVersion:   game.version,
        systemId:         game.system.id,
        systemVersion:    game.system.version,
        instanceLanguage: game.i18n.lang,
        moduleVersion:    mod?.version ?? 'unknown',
        userRole:         game.user.role,
        details,
      };

      const res = await fetch(this.#telemetryUrl, {
        method:    'POST',
        headers:   { 'Content-Type': 'application/json' },
        body:      JSON.stringify(payload),
        keepalive: true,
      });

      if (!res.ok) return null;

      try {
        const data = await res.json();
        const allMessages = data.messages || [];

        // Filter out messages the user has already dismissed for this version
        const visible = allMessages.filter((m) => m.id && m.title && m.content && !this.#isMessageDismissed(m.id));

        if (visible.length > 0 && !this.#popupShownThisSession) {
          this.#popupShownThisSession = true;
          this.#showPopup(visible);
        }

        return visible;
      } catch {
        return null;
      }

    } catch (err) {
      console.debug(`SavrasLib | ${this.#moduleId} | Telemetry send error:`, err);
      return null;
    }
  }
}

export default SavrasLib;
