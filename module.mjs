const MODULE_ID = "ember-tidy-integration";

Hooks.once("tidy5e-sheet.ready", (api) => {
  console.debug(api);
  api.registerCharacterTab(
    new api.models.HandlebarsTab({
      path: `/modules/${MODULE_ID}/template/attunement.hbs`,
      tabId: 'tidy-emberAttunement',
      title: 'EMBER.ATTUNEMENT.Tab',
      iconClass: "fa-solid fa-moon",
      getData: getData.bind(),
      onRender(params) {
        console.debug(params);
        const myTab = $(params.tabContentsElement);
        myTab.find('.attunementIncrease').click(_changeAttunement.bind(params.app, true));
        myTab.find('.attunementDecrease').click(_changeAttunement.bind(params.app, false));
      }
    })
  );

  api.config.actorTraits.registerActorTrait({
    title: "DND5E.ADVANCEMENT.EmberKnowledge.Title",
    iconClass: "fa-solid fa-books ember-knowledge",
    enabled: (params) => params.context.actor.type === "character",
    openConfiguration: (params) => {
      // new ember.system.applications.EmberKnowledgeConfig({ document: params.data.actor }).render({ force: true });
    },
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
          filledAmount: total,
          minAmount: min,
          maxAmount: max
        }
        return Promise.resolve(context);
      },
      onRender(params) {
        var elements = $(params.element).find(".ember-pip");
        elements.click(_adjustMilestones.bind(params.app, params.data.actor));
      }
    })
  )
});

async function getData(context) {
  Hooks.call("dnd5e.prepareSheetContext", context.actor.sheet, "emberAttunement", context);
  for ( const [name, values] of Object.entries(context.attunements) ) {
    values.width = values.widthPct.substring(0, values.widthPct.length - 1);
  }

  return Promise.resolve(context);
}

async function _changeAttunement(target, status) {
  if (!game.user.isGM) return;
  const type = target.currentTarget.closest("div.attunement")?.dataset?.attunement;
  if (status) {
    await ember.api.systems.attunement.awardAttunementDialog(this.document, type);
  }
  else {
    await ember.api.systems.attunement.revokeAttunementDialog(this.document, type);
  }
}

async function _adjustMilestones(actor, target) {
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
})