/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

let activeTooltip: JQuery<HTMLElement> | null = null;

export function init(parentID: string) {
    $(`#${parentID} .clusterblast-orf`).each(function() {
        const orf = $(this);
        setLabel(orf, parentID);
        setTooltip(orf, parentID);
    });
}

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

function setTooltip(orf: JQuery<HTMLElement>, parentID: string): void {
    const id = orf.attr("id");
    const tooltip = $("<div>");
    tooltip.addClass("clusterblast-tooltip");
    tooltip.attr("id", `${id}-tooltip`);
    tooltip.html((orf.attr("description") || "").replace("[br]", "<br>"));
    $(`#${parentID}`).append(tooltip);
    orf.click(tooltipHandler);
}

function tooltipHandler(this: JQuery<HTMLElement>, ev: JQuery.Event): void {
    const tooltip = $(`#${$(this).attr("id")}-tooltip`);

    if (activeTooltip) {
        activeTooltip.hide();
    }
    activeTooltip = tooltip;

    if (tooltip.css("display") === "none") {
        let offset = $(this).offset();
        if (typeof offset === "undefined") {
            offset = {
                left: 0,
                top: 0,
            };
        }
        tooltip.css("top", offset.top + 10);
        tooltip.css("left", offset.left + 5);

        tooltip.show();
        tooltip.click(function() {$(this).hide(); });
        let timeout = setTimeout(() => tooltip.slideUp("fast"), 5000);
        tooltip.data("timeout", timeout);
        tooltip.mouseover(() => {
            clearTimeout(tooltip.data("timeout"));
        }).mouseout(() => {
            timeout = setTimeout(() => tooltip.slideUp("fast"), 5000);
            tooltip.data("timeout", timeout);
        });
    } else {
        tooltip.hide();
    }
}
