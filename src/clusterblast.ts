/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

let activeTooltip: JQuery<HTMLElement> | null = null;

/**
 * Initialises the labels and tooltip information for each reference ORF in the given element.
 *
 * @param parentID - the parent ID of the element containing the full visualisation for the antiSMASH region
 */
export function init(parentID: string) {
    $(`#${parentID} .clusterblast-orf`).each(function() {
        const orf = $(this);
        setLabel(orf, parentID);
        setTooltip(orf, parentID);
    });
}

/**
 * Creates, populates, and adds a handler for a div containing the label of a reference ORF.
 *
 * @param orf - the ORF element to add to
 * @param parentID - the parent ID of the element containing the full visualisation for the antiSMASH region
 */
function setLabel(orf: JQuery<HTMLElement>, parentID: string): void {
    // parentID example: "clusterblast-16-svg", defined by antismash.modules.clusterblast
    const id = orf.attr("id");
    const label = $("<div>");
    label.addClass("clusterblast-locustag");
    label.attr("id", `${id}-label`);
    const locusTag = orf.attr("locus_tag");
    if (locusTag) {
        label.text(locusTag);
    } else {
        label.text("unknown");
    }

    $(`#${parentID}`).append(label);

    orf.mouseover((e) => {
        let offset = orf.offset();
        if (typeof offset === "undefined") {
            offset = {
                left: 0,
                top: 32,
            };
        }
        label.css("top", offset.top - 32);
        label.css("left", offset.left);
        $(`#${id}-label`).show();
    }).mouseout((e) => {
        $(`#${id}-label`).hide();
    });
}

/**
 * Creates the tooltip and matching event handler for the given reference ORF as an
 * initially hidden element in the parent element.
 *
 * @param orf - the reference ORF element
 * @param parentID - the parent ID of the element containing the full visualisation for the antiSMASH region
 */
function setTooltip(orf: JQuery<HTMLElement>, parentID: string): void {
    const id = orf.attr("id");
    const tooltip = $("<div>");
    tooltip.addClass("clusterblast-tooltip");
    tooltip.attr("id", `${id}-tooltip`);
    tooltip.html((orf.attr("description") || "").replace("[br]", "<br>"));
    $(`#${parentID}`).append(tooltip);
    orf.click(tooltipHandler);
}

/**
 * The handler for reference ORFs to temporarily show tooltips for the ORF that
 * was clicked.
 *
 * @param ev - the JQuery event that triggered the handler
 */
function tooltipHandler(this: JQuery<HTMLElement>, ev: JQuery.Event): void {
    const tooltip = $(`#${$(this).attr("id")}-tooltip`);

    if (activeTooltip) {
        clearTimeout(tooltip.data("timeout"));
        activeTooltip.hide();
    }
    activeTooltip = tooltip;

    if (tooltip.css("display") !== "none") {
        tooltip.hide();
        return;
    }
    let offset = $(this).offset();
    if (typeof offset === "undefined") {
        offset = {
            left: 0,
            top: 0,
        };
    }
    let timeout = setTimeout(() => tooltip.slideUp("fast"), 5000);
    tooltip.css("top", offset.top + 10)
        .css("left", offset.left + 5)
        .show()
        .click(function() {$(this).hide(); })
        .data("timeout", timeout)
        .mouseover(() => clearTimeout(tooltip.data("timeout")))
        .mouseout(() => {
            clearTimeout(tooltip.data("timeout"));
            timeout = setTimeout(() => tooltip.slideUp("fast"), 5000);
            tooltip.data("timeout", timeout);
        });
}
