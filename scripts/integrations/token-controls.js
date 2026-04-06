/**
 * Token Controls Integration
 * Adds Names Generator button to Foundry VTT token toolbar
 */

import { hasNamesGeneratorPermission } from '../utils/permissions.js';
import { logDebug, logError } from '../utils/logger.js';
import { NamesGeneratorApp } from '../apps/generator-app.js';
import { MODULE_ID } from '../shared/constants.js';

// Central function to handle Names Generator opening
// Prevents multiple instances from opening simultaneously
let isGeneratorOpening = false;

function openNamesGenerator() {
  if (isGeneratorOpening) {
    logDebug("Names generator already opening, ignoring duplicate request");
    return;
  }

  isGeneratorOpening = true;

  try {
    logDebug("Opening Names Generator");
    new NamesGeneratorApp().render(true);
  } catch (error) {
    logError("Error opening Names Generator:", error);
  } finally {
    // Reset flag after a short delay
    setTimeout(() => {
      isGeneratorOpening = false;
    }, 500);
  }
}

/**
 * Token Controls integration - adds Names Generator button to token toolbar
 * @param {Object} controls - Controls object with .tokens structure
 */
export function registerTokenControls(controls) {
  if (!game.settings.get(MODULE_ID, "showInTokenControls")) return;
  if (!hasNamesGeneratorPermission()) return;

  if (controls.tokens?.tools && !controls.tokens.tools.namesGenerator) {
    controls.tokens.tools.namesGenerator = {
      name: 'names-generator',
      title: game.i18n.localize("names.title"),
      icon: 'fas fa-user-tag',
      order: 999,
      button: true,
      visible: true,
      onClick: () => {
        logDebug("Names generator clicked via token controls");
        openNamesGenerator();
      }
    };

    logDebug("Names generator tool added to token controls");
  }
}

/**
 * Direct DOM injection fallback
 * Used when getSceneControlButtons doesn't work
 */
export function injectTokenControlsButtonDirectly() {
  if (!game.settings.get(MODULE_ID, "showInTokenControls")) {
    logDebug("injectTokenControlsButtonDirectly: Setting disabled");
    return;
  }
  if (!hasNamesGeneratorPermission()) {
    logDebug("injectTokenControlsButtonDirectly: No permission");
    return;
  }

  logDebug("injectTokenControlsButtonDirectly: Starting injection attempt for token tools");

  // Check if button already exists
  if ($('[data-tool="names-generator"]').length > 0) {
    logDebug("injectTokenControlsButtonDirectly: Button already exists");
    return;
  }

  // Try to find token tools container specifically
  let tokenToolsContainer = null;
  const tokenToolsSelectors = [
    '.control-tools[data-control="token"]',
    '.scene-control-tools[data-control="token"]',
    '#controls .control-tools[data-control="token"]'
  ];

  for (const selector of tokenToolsSelectors) {
    const found = $(selector);
    if (found.length > 0) {
      tokenToolsContainer = found.first();
      logDebug(`injectTokenControlsButtonDirectly: Found token tools with selector ${selector}`);
      break;
    }
  }

  // If no specific token tools found, try to find token control and its tools
  if (!tokenToolsContainer || tokenToolsContainer.length === 0) {
    logDebug("injectTokenControlsButtonDirectly: Looking for token control and its tools");

    const tokenControl = $('.scene-control[data-control="token"]');
    if (tokenControl.length > 0) {
      // Look for tools container near the token control
      tokenToolsContainer = tokenControl.siblings('.control-tools[data-control="token"]');
      if (tokenToolsContainer.length === 0) {
        tokenToolsContainer = tokenControl.next('.control-tools');
      }
      if (tokenToolsContainer.length === 0) {
        tokenToolsContainer = $('.control-tools[data-control="token"]');
      }

      if (tokenToolsContainer.length > 0) {
        logDebug("injectTokenControlsButtonDirectly: Found token tools via token control");
      }
    }
  }

  if (!tokenToolsContainer || tokenToolsContainer.length === 0) {
    logDebug("injectTokenControlsButtonDirectly: No token tools container found, using fallback");

    // Fallback: try to find any tools container and use the first one
    const anyToolsContainer = $('.control-tools').first();
    if (anyToolsContainer.length > 0) {
      tokenToolsContainer = anyToolsContainer;
      logDebug("injectTokenControlsButtonDirectly: Using first available tools container as fallback");
    } else {
      logDebug("injectTokenControlsButtonDirectly: No tools container found at all");
      return;
    }
  }

  logDebug("injectTokenControlsButtonDirectly: Using token tools container", {
    id: tokenToolsContainer.attr('id'),
    classes: tokenToolsContainer.attr('class'),
    dataControl: tokenToolsContainer.attr('data-control'),
    children: tokenToolsContainer.children().length
  });

  // Create our tool button specifically for token tools
  const namesButton = $(`
    <li class="scene-control-tool" data-tool="names-generator" title="${game.i18n.localize("names.title") || 'Namen-Generator'}">
      <i class="fas fa-user-tag"></i>
    </li>
  `);

  // Add click handler
  namesButton.click((event) => {
    event.preventDefault();
    event.stopPropagation();
    logDebug("Names tool button clicked via DOM injection into token tools");
    openNamesGenerator();
  });

  // Additional event delegation for v13 compatibility
  namesButton.on('mousedown touchstart', (event) => {
    event.preventDefault();
    event.stopPropagation();
    logDebug("Names tool button pressed via DOM injection into token tools");
    openNamesGenerator();
  });

  // Insert into token tools container
  tokenToolsContainer.append(namesButton);
  logDebug("injectTokenControlsButtonDirectly: Names tool added to token tools container");

  // Setup event handlers after injection
  setTimeout(() => {
    setupControlEventHandling();
  }, 100);
}

// Track if hooks are already registered
let controlHooksRegistered = false;

/**
 * Setup event handling for token controls
 */
function setupControlEventHandling() {
  // Debug: Log all existing token tools
  const existingTools = $('[data-tool]');
  logDebug("setupControlEventHandling: Found existing tools", {
    count: existingTools.length,
    tools: existingTools.map((i, el) => $(el).attr('data-tool')).get()
  });

  // Hook into control tool activation - only register once
  if (!controlHooksRegistered) {
    // v13: controlTool hook
    Hooks.on('controlTool', function namesControlToolHandler(tool, active) {
      logDebug("controlTool hook called", { tool, active });
      if (tool === 'names-generator' && active) {
        logDebug("Names generator activated via controlTool hook (v13)");
        openNamesGenerator();
      }
    });

    // v14: activateSceneControls replaces controlTool for tool-change events
    Hooks.on('activateSceneControls', function namesActivateSceneControlsHandler(sceneControls, { control, tool } = {}) {
      logDebug("activateSceneControls hook called", { control, tool });
      if (tool === 'names-generator') {
        logDebug("Names generator activated via activateSceneControls hook (v14)");
        openNamesGenerator();
      }
    });

    controlHooksRegistered = true;
    logDebug("Registered controlTool (v13) and activateSceneControls (v14) hooks");
  }

  $(document).off('click.names-tools');
  $(document).on('click.names-tools', '[data-tool="names-generator"]', function(event) {
    event.preventDefault();
    event.stopPropagation();
    logDebug("Names tool clicked via event delegation", {
      target: event.target.tagName,
      currentTarget: event.currentTarget.tagName,
      dataTool: $(this).attr('data-tool')
    });
    openNamesGenerator();
  });

  // Also try direct click handler on existing tools
  $('[data-tool="names-generator"]').off('click.names-direct').on('click.names-direct', function(event) {
    event.preventDefault();
    event.stopPropagation();
    logDebug("Names tool clicked via direct handler");
    openNamesGenerator();
  });

  logDebug("Control event handling setup completed", {
    namesToolsFound: $('[data-tool="names-generator"]').length
  });
}

/**
 * Setup global event delegation for Names control buttons
 */
export function setupGlobalEventDelegation() {
  // Remove any existing delegation
  $(document).off('click.names-control');

  // Add event delegation for Names control buttons (both old control and new tool)
  $(document).on('click.names-control', '[data-control="names"], .scene-control[data-control="names"], [data-tool="names-generator"], .scene-control-tool[data-tool="names-generator"]', function(event) {
    event.preventDefault();
    event.stopPropagation();
    logDebug("Names control/tool clicked via global event delegation", {
      element: this.tagName,
      dataControl: $(this).attr('data-control'),
      dataTool: $(this).attr('data-tool')
    });
    openNamesGenerator();
  });

  logDebug("Global event delegation setup for Names controls");
}

/**
 * Token Controls - Direct DOM injection approach
 * Adds button directly to the rendered scene controls
 */
export function registerRenderSceneControls(sceneControls, html, data) {
  try {
    if (!game.settings.get(MODULE_ID, "showInTokenControls")) return;
    if (!hasNamesGeneratorPermission()) return;

    logDebug("renderSceneControls called", {
      sceneControlsType: typeof sceneControls,
      htmlType: typeof html,
      hasControls: !!sceneControls?.controls
    });

    if (!(html instanceof HTMLElement)) {
      logError("renderSceneControls: Unexpected html parameter type", typeof html);
      return;
    }

    const $html = $(html);

    logDebug("renderSceneControls: HTML converted to jQuery", { htmlLength: $html.length });

    // Check if button already exists
    if ($html.find('[data-tool="names-generator"]').length > 0) {
      logDebug("renderSceneControls: Names tool already exists");
      return;
    }

    // Debug: Log all scene controls found
    const allControls = $html.find('.scene-control');
    logDebug("renderSceneControls: Found scene controls", {
      count: allControls.length,
      controls: allControls.map((i, el) => $(el).attr('data-control')).get()
    });

    // Try multiple selectors for token control
    let tokenControl = $html.find('.scene-control[data-control="token"]');
    if (tokenControl.length === 0) {
      tokenControl = $html.find('[data-control="token"]');
    }
    if (tokenControl.length === 0) {
      tokenControl = $html.find('.scene-control').filter((i, el) => $(el).text().toLowerCase().includes('token'));
    }

    if (tokenControl.length === 0) {
      logDebug("renderSceneControls: No token control found with any selector");
      return;
    }

    logDebug("renderSceneControls: Token control found", { length: tokenControl.length });

    // Try multiple approaches to find tools container
    let tokenToolsContainer = tokenControl.siblings('.control-tools[data-control="token"]');
    if (tokenToolsContainer.length === 0) {
      tokenToolsContainer = $html.find('.control-tools[data-control="token"]');
    }
    if (tokenToolsContainer.length === 0) {
      tokenToolsContainer = tokenControl.next('.control-tools');
    }
    if (tokenToolsContainer.length === 0) {
      // Try to find any tools container
      tokenToolsContainer = $html.find('.control-tools').first();
    }

    if (tokenToolsContainer.length === 0) {
      logDebug("renderSceneControls: No token tools container found, trying alternative approach");

      // Alternative: Add directly to the main controls area
      const controlsContainer = $html.find('#controls');
      if (controlsContainer.length > 0) {
        // Create a simple button and add it to the main area
        const namesButton = $(`
          <li class="scene-control" data-control="names" title="${game.i18n.localize("names.title")}">
            <i class="fas fa-user-tag"></i>
          </li>
        `);

        namesButton.click((event) => {
          event.preventDefault();
          event.stopPropagation();
          openNamesGenerator();
        });

        controlsContainer.append(namesButton);
        logDebug("Names generator button added to main controls (fallback)");
        return;
      }

      logDebug("renderSceneControls: No suitable container found");
      return;
    }

    logDebug("renderSceneControls: Token tools container found", { length: tokenToolsContainer.length });

    // Create our tool button
    const namesButton = $(`
      <li class="scene-control-tool" data-tool="names-generator" title="${game.i18n.localize("names.title")}">
        <i class="fas fa-user-tag"></i>
      </li>
    `);

    // Add click handler
    namesButton.click((event) => {
      event.preventDefault();
      event.stopPropagation();
      openNamesGenerator();
    });

    // Add the button to the token tools
    tokenToolsContainer.append(namesButton);
    logDebug("Names generator tool added to token controls");

    // Setup event handlers after DOM injection
    setTimeout(() => {
      setupControlEventHandling();
    }, 100);
  } catch (error) {
    logError("Error in renderSceneControls hook", error);
  }
}

export { openNamesGenerator };
