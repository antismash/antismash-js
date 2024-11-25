/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

import {IRecord} from "./classes/pythonStructures.js";
import {copyToClipboard} from "./clipboard.js";
import {drawClusterblast, setClusterblastData} from "./clusterblast.js";
import {toggleCollapserHandler} from "./collapsers.js";
import {setComparisonData} from "./comparison.js";
import {setupDetails} from "./detailsSection.js";
import {drawDomainBubbleData} from "./domainBubbles.js";
import {initDownloadButtons} from "./downloader.js";
import {drawGenericDomains, redrawGenericDomains} from "./genericDomains.js";
import {initGeneTableHandler} from "./geneTable.js";
import {createModuleHandlers, drawDomains, redrawDomains} from "./jsdomain.js";
import {createRecordOverviews} from "./recordOverview.js";
import {drawStructures} from "./structureDrawing.js";
import {drawBindingSites} from "./tfbs.js";
import {drawRegion} from "./viewer.js";

export { downloadSvg } from "./downloader.js";

const visualiserRoot = "antismash.outputs.html.visualisers";

let allRegions: any = null;
let resultsData: any = null;

/**
 * An event handler for toggling the visibility of the Download menu in the header.
 *
 * @param event - the event that triggered the handler
 */
function toggle_downloadmenu(event: JQuery.Event) {
    event.preventDefault();
    $("#downloadmenu").fadeToggle("fast", "linear");
}

/**
 * Finds the anchor string (e.g. "r1c1" or "overview") for the currently displayed
 * section.
 *
 * @returns The anchor string of the currently displayed section.
 */
export function getAnchor(): string {
    const anchor = window.location.hash.substring(1);
    if (anchor) {
        return anchor;
    }
    return "overview";
}

/**
 * Updates all handlers and sets up all relevant visualisations for the current region.
 */
function switchToRegion() {
    const domainOrfHeight = 25;
    setTimeout(() => {
        $(".page").hide();
        $(".empty-on-leave").empty();
        $(".regbutton").removeClass("active");
        const anchor = getAnchor();
        $(`#${anchor}`).show();
        if (anchor === "overview") {
            return;
        }
        $(`.regbutton.${anchor}`).addClass("active");
        if (allRegions[anchor] !== undefined) {
            drawRegion(`${anchor}-svg`, allRegions[anchor], 20);
        }
        setClusterblastData(anchor, resultsData[anchor]["antismash.modules.clusterblast"], allRegions[anchor]);
        if (anchor in resultsData) {
            // draw details domains after the region so locus to id conversion works correctly
            if (`${visualiserRoot}.nrps_pks_domains` in resultsData[anchor]) {
                drawDomains(anchor, resultsData[anchor][`${visualiserRoot}.nrps_pks_domains`], domainOrfHeight);
            }
            if ("antismash.modules.cluster_compare" in resultsData[anchor]) {
                setComparisonData(anchor, resultsData[anchor]["antismash.modules.cluster_compare"], allRegions[anchor]);
            }
            if (`${visualiserRoot}.bubble_view` in resultsData[anchor]) {
                drawDomainBubbleData(anchor, resultsData[anchor][`${visualiserRoot}.bubble_view`]);
            }
            if (`${visualiserRoot}.generic_domains` in resultsData[anchor]) {
                drawGenericDomains(anchor, resultsData[anchor][`${visualiserRoot}.generic_domains`], domainOrfHeight);
            }
            if (`${visualiserRoot}.gene_table` in resultsData[anchor]) {
                initGeneTableHandler(allRegions[anchor], resultsData[anchor][`${visualiserRoot}.gene_table`]);
            }
            if ("antismash.modules.tfbs_finder" in resultsData[anchor]) {
                drawBindingSites(anchor, resultsData[anchor]["antismash.modules.tfbs_finder"]);
            }
        }
        $(`#${anchor} .comparison-selector`).change();
        // trigger any required click-event for the default details tab
        $(`#${anchor} * .body-details-header-active`).first().click();
    }, 1);
}

/**
 * Changes the region view to the next region in line.
 * If no region follows the current region, the overview will be shown.
 * If the current view is of the overview, the first possible region will be shown.
 */
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

/**
 * Changes the region view to the previous region in line.
 * If no region precedes the current region, the overview will be shown.
 * If the current view is of the overview, the last possible region will be shown.
 */
function previousRegion() {
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

/**
 * Cycles through the body details panel in a region to the next or previous tab.
 *
 * @param className - the class of the currently active element
 * @param direction - the direction of the next tab (positive is right, others are left)
 */
function changeElementInRegion(className: string, direction: number) {
    const activeClassName = className + "-active";
    const currentRegion = getAnchor();
    const tabs = $(`#${currentRegion}`).find(`.${className}`);
    const currentTab = $(`#${currentRegion}`).find(`.${activeClassName}`);
    if (!tabs || !currentTab) { // no tabs for current region
        return;
    }
    if (!currentTab) { // no tabs for current region
        return;
    }
    if (direction > 0) {
        if (currentTab.is(tabs.last())) {
            tabs.first().trigger("click");
        } else {
            currentTab.next().trigger("click");
        }
    } else {
        if (currentTab.is(tabs.first())) {
            tabs.last().trigger("click");
        } else {
            currentTab.prev().trigger("click");
        }
    }
}

/**
 * Adds all event handlrs required for the overview section of the page.
 */
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

/**
 * An event handler for keyboard hotkeys.
 *
 * @param event - the keyboard event triggering the handler
 */
function keyUpEvent(event: KeyboardEvent) {
    const key = event.keyCode;
    if (key === 37 || key === 87) {  // left arrow or w
        previousRegion();
    } else if (key === 39 || key === 69) {  // right arrow or e
        nextRegion();
    }
    // ignore tab-related keystrokes if no tabs available
    if (getAnchor() === "overview") {
        return;
    }
    if (key === 65) {  // a
        changeElementInRegion("body-details-header", -1);
    } else if (key === 83) {  // s
        changeElementInRegion("body-details-header", 1);
    } else if (key === 68) {  // d
        changeElementInRegion("sidepanel-details-header", -1);
    } else if (key === 70) {  // f
        changeElementInRegion("sidepanel-details-header", 1);
    } else if (key === 77) {  // m
        $("input.show-module-domains").first().click();
    }
}

/**
 * An event handler that toggles the visibility of the element containing cluster rule details.
 *
 * @param ev - the triggering event
 */
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

/**
 * Maps some raw product types to a more readable name.
 *
 * @param type - the product type to convert
 * @returns The more descriptive version, if available, otherwise the same value as the input.
 */
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

/**
 * Adds handlers to show help tooltips for relevant elements
 */
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

/**
 * The entry point for all antiSMASH visualisation.
 *
 * @param regions - the data describing all regions within the output
 * @param results - the data describing additional visualisation results (e.g. gene table)
 * @param recordData - the data describing records/contigs and the genes within them
 */
export function start(regions: any, results: any, records: IRecord[]) {
    createRecordOverviews(records);
    allRegions = regions;
    resultsData = results;
    document.addEventListener("keyup", keyUpEvent, false);
    $("#download").click(toggle_downloadmenu);

    $("#next-region").click(nextRegion);
    $("#prev-region").click(previousRegion);

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
    $(".comparison-selector").change(function() {
        const id = ($(this).attr("id") || "nonexistant").replace("-selector", "");
        $(`#${id}`).siblings().removeClass("comparison-container-active");
        const kind = $(this).attr("data-tag");
        $(`#${id}-${$(this).val()}`).addClass("comparison-container-active")
            .find(`.heat-row-${kind}`).first().click();
    });
    $(".cluster-rules-header").click(toggle_cluster_rules);
    switchToRegion();
    createOverviewHandlers();
    $("input.domains-selected-only")
        .change(function() {
            // apply the change to all regions
            $("input.domains-selected-only").prop("checked", $(this).prop("checked"));
            redrawDomains();
            redrawGenericDomains();
        });
    $(`input.domains-expand-full`).change(function() {
        // apply the change to all regions
        $("input.domains-expand-full").prop("checked", $(this).prop("checked"));
        redrawGenericDomains({reset: true, anchor: getAnchor()});
    });
    createModuleHandlers();
    drawStructures();
    setupDetails(regions.order);
    addHelpTooltipHandlers();
    $(".clipboard-copy").off("click").click(copyToClipboard);
    $(".collapser").click(toggleCollapserHandler);
    initDownloadButtons();
}
