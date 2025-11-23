const MODULE_ID = "ember-tidy-integration";

Hooks.once("tidy5e-sheet.ready", (api) => {
  console.debug(api);
  api.registerCharacterTab(
    new api.models.HandlebarsTab({
      path: `/modules/${MODULE_ID}/template/attunement.hbs`,
      tabId: 'tidy-emberAttunement',
      title: 'EMBER.ATTUNEMENT.Tab',
      iconClass: "fa-solid fa-moon",
      getData: getAttunementData.bind(),
      onRender(params) {
        const myTab = $(params.tabContentsElement);
        myTab.find('[data-action="attunementIncrease"]').click(changeAttunement.bind(params.app, true));
        myTab.find('[data-action="attunementDecrease"').click(changeAttunement.bind(params.app, false));
      }
    })
  );

  api.config.actorTraits.registerActorTrait({
    title: "DND5E.ADVANCEMENT.EmberKnowledge.Title",
    iconClass: "fa-solid fa-books ember-knowledge",
    enabled: (params) => params.context.actor.type === "character",
    openConfiguration: (params) => {
      new ember.system.applications.EmberKnowledgeConfig({ document: params.data.actor }).render({ force: true });
    },
    pills: generateKnowledgePills.bind(),
    openConfigurationTooltip: "DND5E.ADVANCEMENT.EmberKnowledge.Configure",
  });

  api.registerGroupContent(
    new api.models.HandlebarsContent({
      path: `/modules/${MODULE_ID}/template/group-milestones.hbs`,
      injectParams: {
        selector: `.tidy-tab.members [data-tidy-sheet-part="${api.constants.SHEET_PARTS.ACTION_BAR}"]`,
        position: "beforebegin",
      },
      getData: (context) => {
        const { ADVANCEMENT } = ember.CONST;
        const { level: calculatedLevel, total } = ember.system.actors.getMilestones(context.actor);
        const level = Math.clamp(calculatedLevel, 1, context.actor.system.level);
        const min = ADVANCEMENT[level];
        const max = ADVANCEMENT[level + 1];
        context.emberMilestones = {
          level: level,
          calculatedLevel: calculatedLevel,
          filledAmount: total,
          minAmount: min,
          maxAmount: max
        }
        return Promise.resolve(context);
      },
      onRender(params) {
        // Add milestone adjustment
        const elements = $(params.element).find(".ember-pip");
        elements.click(adjustMilestones.bind(params.app, params.data.actor));

        // Add marker for characters which can be leveled up
        const emberMilestones = params.data.emberMilestones;
        for (const actor of params.data.members.character) {
          if (actor.system.details.level >= emberMilestones.calculatedLevel) continue;
          const actorElement = $(params.element).find(`[data-tidy-section-key="character"] [data-member-id="${actor.id}"]`);
          const nameElement = actorElement.find(".tidy-table-cell.text-cell.primary")[0];
          nameElement.insertAdjacentHTML("afterend", `
            <div class="tidy-table-cell" data-tidy-sheet-part="table-cell" style="--tidy-table-column-width: 2.5rem;" data-tidy-render-scheme="handlebars">
              <img class="tidy-level-up" src="icons/svg/upgrade.svg" data-tooltip="EMBER.MILESTONE.CanLevel">
            </div>
          `);
        }
      }
    })
  );


});

// Attunement Tab
function getAttunementData(context) {
  Hooks.call("dnd5e.prepareSheetContext", context.actor.sheet, "emberAttunement", context);
  for (const [name, values] of Object.entries(context.attunements)) {
    values.width = values.widthPct.substring(0, values.widthPct.length - 1);
  }

  return context;
}

async function changeAttunement(status, target) {
  if (!game.user.isGM) return;
  const type = target.currentTarget.closest("div.attunement")?.dataset?.attunement;
  if (status) {
    await ember.api.systems.attunement.awardAttunementDialog(this.document, type);
  }
  else {
    await ember.api.systems.attunement.revokeAttunementDialog(this.document, type);
  }
}

// Knowledges
function generateKnowledgePills(context) {
  const knowledges = context.data.document.getFlag("ember", "knowledge") || [];
  const customPills = knowledges.map(name => {
    return {
      label: `${ember.CONST.KNOWLEDGE_TYPES[name].label}`
    }
  })
  return customPills;
}

// Milestone Pips for Group Sheet
function adjustMilestones(actor, target) {
  if (!game.user.isGM) return;
  const number = target.currentTarget.dataset.number;
  const { total } = ember.system.actors.getMilestones(actor);
  const diff = number - total;
  if (diff > 0) {
    ember.system.actors.awardMilestoneDialog(actor, { number: diff });
  }
  else {
    ember.system.actors.revokeMilestoneDialog(actor);
  }
}

Handlebars.registerHelper('tidyEmberPips', function (data) {
  let response = '';
  for (let i = data.hash.min; i < data.hash.max; i++) {
    response += `<div class="ember-pip pip ${i < data.hash.filled ? "active" : "inactive"}" data-number=${i + 1}></div>`;
  }
  return response;
});

const _vulgarFractions = {
  "0.125": "⅛",
  "0.25": "¼",
  "0.5": "½",
  "0.75": "¾"
};

// Render Hook stuff
Hooks.on("renderTidy5eActorSheetQuadroneBase2", (sheet, element, data) => {
  // Ember class to Biography tab
  if (["character", "npc"].includes(data.type)) {
    element
      .querySelector('[data-tab-contents-for="biography"]')
      ?.classList.add("ember")
  }
  // Fractional speeds
  if (data.type === "group") {
    const groupSpeeds = element.querySelector('.group-speeds');
    const classNames = ['divider-dot', 'speed'];
    groupSpeeds.childNodes.forEach(groupSpeedEl => {
      if (groupSpeedEl.classList && classNames.some(className => groupSpeedEl.classList.contains(className))) {
        groupSpeedEl.remove();
      }
    });

    const { movement } = data.system.attributes;
    if (movement.air > 0 || movement.land > 0 || movement.water > 0) {
      const { pace } = movement;
      const paceConfig = CONFIG.DND5E.travelPace[pace];

      const insertionElement = groupSpeeds.querySelector(".travel-pace");
      ['air', 'water', 'land'].forEach(speed => {
        const value = movement[speed] * (paceConfig?.multiplier ?? 1);
        if (value) {
          insertionElement.insertAdjacentHTML("afterend", `
            <span class="speed">
              <span class="color-text-gold font-label-medium">${game.i18n.localize(`DND5E.Movement${speed.capitalize()}`)}</span>
              <span class="color-text-default font-data-large">${_vulgarFractions[value] ?? value}</span>
              <span class="color-text-lighter font-label-medium">${movement.units}</span>
            </span>
            `);
          insertionElement.insertAdjacentHTML("afterend", `<div class="divider-dot"></div>`);
        }
      });
    }
  }
});