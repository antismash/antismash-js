/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

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

function bodyHandler(this: HTMLElement, regionLabel: string, event: JQuery.Event): void {
    swapBody($(this), regionLabel);

    const matchingSidepanel = $(`#${regionLabel} * .sidepanel-details-header.${$(this).attr("data-name")}`);
    if (matchingSidepanel.length > 0) {
        swapSidepanel(matchingSidepanel, regionLabel);  // important not to click, to avoid recursion
    }
}

function swapBody(target: JQuery<HTMLElement>, regionLabel: string): void {
    $(`#${regionLabel} * .body-details-section`).hide();
    $(`#${regionLabel} * .body-details-header-active`).toggleClass("body-details-header-active");
    target.addClass("body-details-header-active");
    $(`#${regionLabel} * .body-details-section.${target.attr("data-name")}`).show();
}

function sidepanelHandler(this: HTMLElement, regionLabel: string, event: JQuery.Event): void {
    swapSidepanel($(this), regionLabel);
    const matchingBody = $(`#${regionLabel} * .body-details-header.${$(this).attr("data-name")}`);
    matchingBody.click();  // important to click, since body details tend to have draw handlers
}

function swapSidepanel(target: JQuery<HTMLElement>, regionLabel: string): void {
    $(`#${regionLabel} * .sidepanel-details-section`).hide();
    $(`#${regionLabel} * .sidepanel-details-header-active`).toggleClass("sidepanel-details-header-active");
    target.addClass("sidepanel-details-header-active");
    $(`#${regionLabel} * .sidepanel-details-section.${target.attr("data-name")}`).show();
}
