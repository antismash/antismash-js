/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

/**
 * Adds handlers to body and sidepanel details sections of visualisations for
 * the given regions.
 *
 * @param regionLabels - an array of region anchor strings
 */
export function setupDetails(regionLabels: string[]) {
    $(".sidepanel-details-header").off("click");
    $(".sidepanel-details-section").hide();
    for (const regionLabel of regionLabels) {
        $(`#${regionLabel} * .sidepanel-details-header`)
            .click($.proxy(sidepanelHandler, null, regionLabel))
            .first()
                .trigger("click");
    }

    $(".body-details-header").off("click");
    $(".body-details-section").hide();
    for (const regionLabel of regionLabels) {
        $(`#${regionLabel} * .body-details-header`)
            .click($.proxy(bodyHandler, null, regionLabel))
            .first()
                .trigger("click");
    }
}

/**
 * An event handler for swapping to new body detail panels when a tab is selected.
 * If a matching sidepanel exists, it will also be selected.
 *
 * @param regionLabel - the anchor of the region in which the event was fired
 * @param event - the triggering event
 */
function bodyHandler(this: HTMLElement, regionLabel: string, event: JQuery.Event): void {
    swapBody($(this), regionLabel);

    const matchingSidepanel = $(`#${regionLabel} * .sidepanel-details-header.${$(this).attr("data-name")}`);
    if (matchingSidepanel.length > 0) {
        swapSidepanel(matchingSidepanel, regionLabel);  // important not to click, to avoid recursion
    }
}

/**
 * Swaps the currently shown body details to the one matching the target tab.
 *
 * @param target - the element for the details tab to which the body belongs
 * @param regionLabel - the anchor of the region to which the body belongs
 */
function swapBody(target: JQuery<HTMLElement>, regionLabel: string): void {
    $(`#${regionLabel} * .body-details-section`).hide();
    $(`#${regionLabel} * .body-details-header-active`).toggleClass("body-details-header-active");
    target.addClass("body-details-header-active");
    $(`#${regionLabel} * .body-details-section.${target.attr("data-name")}`).show();
}

/**
 * An event handler for swapping to new sidepanel details when a tab is selected.
 * If a matching body details panel exists, it will also be selected.
 *
 * @param regionLabel - the anchor of the region in which the event was fired
 * @param event - the triggering event
 */
function sidepanelHandler(this: HTMLElement, regionLabel: string, event: JQuery.Event): void {
    swapSidepanel($(this), regionLabel);
    const matchingBody = $(`#${regionLabel} * .body-details-header.${$(this).attr("data-name")}`);
    matchingBody.click();  // important to click, since body details tend to have draw handlers
}

/**
 * Swaps the currently shown sidepanel details to the one matching the target tab.
 *
 * @param target - the element for the details tab to which the sidepanel belongs
 * @param regionLabel - the anchor of the region to which the sidepanel belongs
 */
function swapSidepanel(target: JQuery<HTMLElement>, regionLabel: string): void {
    $(`#${regionLabel} * .sidepanel-details-section`).hide();
    $(`#${regionLabel} * .sidepanel-details-header-active`).toggleClass("sidepanel-details-header-active");
    target.addClass("sidepanel-details-header-active");
    $(`#${regionLabel} * .sidepanel-details-section.${target.attr("data-name")}`).show();
}
