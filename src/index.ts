/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

import {copyToClipboard} from "./clipboard.js";
import {init as prepClusterblast} from "./clusterblast.js";
import {toggleCollapserHandler} from "./collapsers.js";
import {IRecord} from "./dataStructures.js";
import {setupDetails} from "./detailsSection.js";
import {createButtonHandlers, drawDomains} from "./jsdomain.js";
import {createRecordOverviews} from "./recordOverview.js";
import {drawStructures} from "./structureDrawing.js";
import {drawRegion} from "./viewer.js";

let allRegions: any = null;
let detailsData: any = null;

function toggle_downloadmenu(event: JQuery.Event) {
    event.preventDefault();
    $("#downloadmenu").fadeToggle("fast", "linear");
}

export function getAnchor(): string {
    const anchor = window.location.hash.substring(1);
    if (anchor) {
        return anchor;
    }
    return "overview";
}

function switchToRegion() {
    setTimeout(() => {
        $(".page").hide();
        $(".regbutton").removeClass("active");
        const anchor = getAnchor();
        $(`#${anchor}`).show();
        if (anchor !== "overview") {
            $(`.regbutton.${anchor}`).addClass("active");
        }

        if (allRegions[anchor] !== undefined) {
            drawRegion(`${anchor}-svg`, allRegions[anchor], 20);
        }
        // draw details domains after the region so locus to id conversion works correctly
        if ($(`#${anchor}-details-svg`).length > 0) {
            drawDomains(`${anchor}-details-svg`, detailsData[anchor], 25);
        }
        $(`#${anchor} .clusterblast-selector`).change();
    }, 1);
}

function nextRegion() {
    const regions = allRegions.order;
    const current = getAnchor();
    let next = "overview";
    if (current === "overview") {
        next = regions[0];
    } else {
        const currentIndex = regions.indexOf(current);
        if (currentIndex !== regions.length - 1) {
            next = regions[currentIndex + 1];
        }
    }
    window.location.href = `#${next}`;
    switchToRegion();
}

function previous_region() {
    const regions = allRegions.order;
    const current = getAnchor();
    let prev = "";
    if (current === "overview") {
        prev = regions[regions.length - 1];
    } else {
        const currentIndex = regions.indexOf(current);
        if (currentIndex !== 0) {
            prev = regions[currentIndex - 1];
        }
    }
    window.location.href = `#${prev}`;
    switchToRegion();
}

function createOverviewHandlers() {
    $("input.overview-switch-compact")
        .change(function() {
            if ($(this).prop("checked")) {
                $("#single-record-tables").hide();
                $("#compact-record-table").show();
            } else {
                $("#single-record-tables").show();
                $("#compact-record-table").hide();
            }
        }).trigger("change");  // ensure current state is respected on soft refresh
    $(".linked-row").off("click").click(function() {
        const anchor = $(this).attr("data-anchor");
        if (anchor) {
            window.location.href = anchor;
            switchToRegion();
        }
    });
}

function keyUpEvent(event: KeyboardEvent) {
    const key = event.keyCode;
    if (key === 37) {  // left arrow
        previous_region();
    } else if (key === 39) {  // right arrow
        nextRegion();
    }
}

function toggle_cluster_rules(this: JQuery<HTMLElement>, ev: JQuery.Event) {
    ev.preventDefault();
    const id = ($(this).attr("id") || "").replace(/-header/, "");
    if (!id) {
        return;
    }
    const rules = $(`#${id}`);
    if (rules.css("display") === "none") {
        $(this).text("Hide pHMM detection rules used");
    } else {
        $(this).text("Show pHMM detection rules used");
    }
    rules.fadeToggle("fast", "linear");
}

function map_type_to_desc(type: string): string {
    switch (type) {
        case "nrps": return "NRPS";
        case "t1pks": return "Type I PKS";
        case "t2pks": return "Type II PKS";
        case "t3pks": return "Type III PKS";
        case "t4pks": return "Type IV PKS";
        default: return type;
    }
}

function addHelpTooltipHandlers() {
    $(".help-icon").off("click").click(function(this: HTMLElement) {
        $(this).toggleClass("active");
        $(this).next().toggle();
    });
    $(".help-tooltip").off("click").click(function(this: HTMLElement) {
        $(this).hide();
        $(this).prev().removeClass("active");
    });
}

export function start(regions: any, details: any, records: IRecord[]) {
    createRecordOverviews(records);
    allRegions = regions;
    detailsData = details;
    document.addEventListener("keyup", keyUpEvent, false);
    $("#download").click(toggle_downloadmenu);

    $("#next-region").click(nextRegion);
    $("#prev-region").click(previous_region);

    $(".regbutton").click(function() {
        /* Make sure that even if user missed the link and clicked the
        background we still have the correct anchor */
        const href = $(this).children().first().attr("href");

        if (href === undefined) {
            return;
        }
        window.location.href = href;

        switchToRegion();
    }).mouseover(function() {
        /* Set the select region label text to region type */
        const classes =  ($(this).attr("class") || "").split(" ");
        if (classes.length < 2) {
            return;
        }
        if (classes[1] === "separator") {
            return;
        }
        const regionType = map_type_to_desc(classes[1]);
        const label = $("#region-type");
        label.data("orig_text", label.text());
        label.text(`${regionType}:`);
    }).mouseout(() => {
        /* and reset the select region label text */
        const label = $("#region-type");
        label.text(label.data("orig_text"));
    });

    $(".clusterblast-selector").change(function() {
        const id = ($(this).attr("id") || "nonexistant").replace("-select", "");
        const url = "" + $(this).val();
        if (url) {
            $.get(url, (data) => {
                $(`#${id}-svg`).html(data);
                prepClusterblast(`${id}-svg`);
            }, "html");
        }
        $(`#${id}-download`).off("click");
        $(`#${id}-download`).click(() => window.open("" + $(`#${id}-select`).val(), "_blank"));
    });

    $(".cluster-rules-header").click(toggle_cluster_rules);
    switchToRegion();
    createOverviewHandlers();
    createButtonHandlers();
    drawStructures();
    setupDetails(regions.order);
    addHelpTooltipHandlers();
    $(".clipboard-copy").off("click").click(copyToClipboard);
    $(".collapser").click(toggleCollapserHandler);
}
