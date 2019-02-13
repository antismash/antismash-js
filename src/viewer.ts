/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

/*

Don't use jQuery to alter classes of SVG components. It'll only waste your time
and confuse you.

General interaction aims:
    single click:
        selects the gene, or collection of genes, shows relevant information in focus panel
        if on a gene and already selected, clear the selection
    ctrl click:
        adds the gene, or collection of genes, to the current selection
    double click:
        zooms to the collection of genes

*/

import {axisBottom as d3axisBottom} from "d3-axis";
import {drag as d3drag} from "d3-drag";
import {scaleLinear as d3scaleLinear} from "d3-scale";
import {event as d3event, select as d3select, selectAll as d3selectAll} from "d3-selection";
import "d3-transition";  // modifies select and selectAll

import {copyToClipboard} from "./clipboard.js";
import {toggleCollapser, toggleCollapserHandler} from "./collapsers.js";
import {ICluster, IOrf, IRegion, ITTACodon} from "./dataStructures.js";

let HEIGHT = 100;
const LABEL_HEIGHT = 14;
const VERSION: string = "0.0.1";

const SELECTED_ORF_CLASS = "svgene-selected-orf";

export function locusToFullId(locusTag: string): string {
    if (!displayedRegion) {
        return `${tag_to_id(locusTag)}`;
    }
    return `u${uniqueID - 1}-region${displayedRegion.idx}-${tag_to_id(locusTag)}`;
}

function geneArrowPoints(orf: IOrf): string {
    const upper: number = orfY + LABEL_HEIGHT + verticalOffset;
    const lower: number = orfY + LABEL_HEIGHT + HEIGHT - verticalOffset;
    const middle: number = orfY + LABEL_HEIGHT + (HEIGHT / 2);
    if (orf.strand === 1) {
        const start: number = scale(orf.start);
        const boxEnd: number = Math.max(scale(orf.end) - (2 * verticalOffset), start);
        const pointEnd: number = scale(orf.end);
        return `${start},${upper} ${boxEnd},${upper} ${pointEnd},${middle} ${boxEnd},${lower} ${start},${lower}`;
    }
    if (orf.strand === -1) {
        const pointStart = scale(orf.start);
        const end = scale(orf.end);
        const boxStart = Math.min(scale(orf.start) + (2 * verticalOffset), end);
        return `${pointStart},${middle} ${boxStart},${upper} ${end},${upper} ${end},${lower} ${boxStart},${lower}`;
    }
    return `${orf.start},${upper} ${orf.end},${upper} ${orf.end},${lower} ${orf.start},${lower}`;
}

function ttaCodonPoints(codon: ITTACodon, height: number, offset: number, border: number): string {
    const tipY = offset + LABEL_HEIGHT + height;
    const bottom = offset + (2 * LABEL_HEIGHT) + height - border;
    const tipX = Math.floor(scale((codon.start + codon.end) / 2));
    return `${tipX},${tipY} ${tipX - 5},${bottom} ${tipX + 5},${bottom}`;
}

function drawOrderedRegionOrfs(chart: any, allOrfs: IOrf[], borders: ICluster[], ttaCodons: ITTACodon[],
                               idx: number, height: number, width: number, offset: number,
                               selectionStart: number, selectionEnd: number): void {
    /* chart: the SVG DOM element
     allOrfs: the ORF JSON objects created in python
     borders: the ClusterBorder JSON objects created in python
     ttaCodons: the TTA codon JSON objects created in python
     scale: the d3 linearScale used to size the SVG appropriately
     idx: the record index
     height: the draw height for ORFs
     width: the draw width of the ORF centerline
     offset:
     selectionStart: the start position of the view
     selectionEnd: the end position of the view
    */
    if (displayedRegion === null) {
      return;
    }
    const regionIndex: number = displayedRegion.idx;
    orfY = Math.max.apply(Math, borders.map((border) => border.height)) * 12 + LABEL_HEIGHT;
    HEIGHT = height;
    // ORF centerline
    chart.append("line")
    .attr("x1", 0)
    .attr("y1", orfY + LABEL_HEIGHT + height / 2)
    .attr("x2", width)
    .attr("y2", orfY + LABEL_HEIGHT + height / 2)
    .attr("class", "centerline");

    // clusters
    const barSize = 10;
    const verticalBarGap = 2;
    const clusterBars: d3.Selection<SVGGElement, ICluster, any, any> = chart.selectAll("g.cluster-bar-group")
        .data(borders)
        .enter().append("g").attr("class", (d: ICluster) => (
            d.isSuperCluster
                ? `supercluster-${d.product.split(" ")[2].replace("chemical_", "")}` // e.g. "supercluster-hybrid"
                : `svgene-border-${d.tool}`))
        .on("click", (d: ICluster) => {
            if ($(`.${SELECTED_ORF_CLASS}`).length === allOrfs.length || !d3event.ctrlKey) {
                deselectOrfs();
            }
            select_by_range(d.neighbouring_start, d.neighbouring_end);
            toggleSuperclusterCollapsers(d);
        })
        .on("dblclick", (d: ICluster) => {
            select_by_range(d.neighbouring_start, d.neighbouring_end);
            toggleSuperclusterCollapsers(d);
            change_view(d.neighbouring_start, d.neighbouring_end);
        });
    // background
    clusterBars.append("rect")
        .attr("width", (d) => scale(d.neighbouring_end) - scale(d.neighbouring_start))
        .attr("height", barSize)
        .attr("x", (d) => scale(d.neighbouring_start))
        .attr("y", (d) => d.height * (barSize + verticalBarGap) + offset)
        .attr("opacity", "0.5")
        .attr("class", (d) => `cluster-background ${d.product}`)
        .style("stroke-width", "0");
    // extent lines
    clusterBars.append("line")
        .attr("x1", (d) => scale(d.neighbouring_start))
        .attr("y1", (d) => d.height * (barSize + verticalBarGap) + offset + barSize / 2)
        .attr("x2", (d) => scale(d.neighbouring_end))
        .attr("y2", (d) => d.height * (barSize + verticalBarGap) + offset + barSize / 2)
        .attr("class", "cluster-line");
    // rect containing first and last ORF triggering border detection
    clusterBars.append("rect")
        .attr("width", (d) => scale(d.end) - scale(d.start))
        .attr("height", barSize)
        .attr("x", (d) => scale(d.start))
        .attr("y", (d) => d.height * (barSize + verticalBarGap) + offset)
        .attr("class", (d) => `cluster-core ${d.product}`)
        .style("stroke", "black");
    // cluster name
    clusterBars.append("text")
        .attr("x", (d) => scale((d.start + d.end) / 2))
        .attr("y", (d) => (d.tool === "rule-based-clusters"
                                            ? ((d.height - 1) * (barSize + verticalBarGap) - verticalBarGap + barSize + offset)
                                            : ((d.height) * (barSize + verticalBarGap) - verticalBarGap + barSize + offset)))
        .style("font-size", "xx-small")
        .attr("class", "clusterlabel")
        .attr("text-anchor", "middle")
        .style("pointer-events", "none")
        .text((d) => d.product.replace("_", " "));

    // ORFs
    const orfs: d3.Selection<SVGGElement, IOrf, any, any> = chart.selectAll("g.orf-group")
        .data(allOrfs)
        .enter().append("g").attr("class", "orf-group");
    // hide the ORF centerline
    orfs.append("polygon")
        .attr("points", (d) => geneArrowPoints(d))
        .attr("class", "svgene-orf-bg")
        .attr("id", (d) => `u${idx}-region${regionIndex}-${tag_to_id(d.locus_tag)}-svgeneorf-bg`)
        .style("fill", "white");
    // draw the ORF itself
    orfs.append("polygon")
        .attr("points", (d) => geneArrowPoints(d))
        .attr("class", (d) => `svgene-type-${d.type} svgene-orf ${SELECTED_ORF_CLASS}`)
        .attr("id", (d) => `u${idx}-region${regionIndex}-${tag_to_id(d.locus_tag)}-svgeneorf`)
        .attr("opacity", "1");

    // TTA codons
    const ttaCodonElements: d3.Selection<SVGGElement, ITTACodon, any, any> = chart.selectAll("polyline.svgene-tta-codon")
        .data(ttaCodons)
        .enter().append("polyline")
        .attr("points", (d: ITTACodon) => ttaCodonPoints(d, height, orfY, offset))
        .attr("class", "svgene-tta-codon");

    // ORF labels
    const locusTags: d3.Selection<SVGTextElement, IOrf, any, any> = chart.selectAll("text.svgene-locustag")
        .data(allOrfs)
        .enter().append("text")
        // to prevent truncating locus tags, right-align labels after the midpoint
        .attr("x", (d: IOrf) => scale(d.start) < width / 2 ? scale(d.start) : scale(d.end))
        .attr("text-anchor", (d: IOrf) => scale(d.start) < width / 2 ? "start" : "end")
        .attr("y", orfY + LABEL_HEIGHT)
        .attr("class", "svgene-locustag")
        .attr("id", (d: IOrf) => `u${idx}-region${regionIndex}-${tag_to_id(d.locus_tag)}-label`)
        .text((d: IOrf) => d.locus_tag);

    // mark ORFs that contain TTA codons
    for (const tta of ttaCodons) {
        for (const locus of tta.containedBy) {
            const id = `#u${idx}-region${regionIndex}-${tag_to_id(locus)}-svgeneorf`;
            const orf: d3.Selection<SVGElement, IOrf, any, any> = d3select(id);
            orf.classed("contains-tta-codon", true);
        }
    }
}

export function drawRegion(id: string, regionToDraw: IRegion, height: number,
                           selectionStart?: number, selectionEnd?: number): void {
    if (displayedRegion) {
        d3select(`#${displayedRegion.anchor}-svg`).selectAll("*").remove();
        $(".legend-selected").removeClass("legend-selected");
    }
    displayedRegion = regionToDraw;
    const region = regionToDraw;
    if (displayedRegion === null) {
        return;
    }
    if (typeof selectionStart === "undefined") {
        selectionStart = region.start;
    }
    if (typeof selectionEnd === "undefined") {
        selectionEnd = region.end;
    }

    const axisHeight = 20;
    const minimapHeight = 40;
    const clusterHeight = Math.max.apply(Math, region.clusters.map((border) => border.height)) * 12;
    const ttaHeight = region.ttaCodons.length > 0 ? Math.floor(height * 2 / 3) : 0;
    const realHeight = height + (2 * LABEL_HEIGHT) + clusterHeight + minimapHeight + axisHeight + ttaHeight;
    const regionIndex: number = region.idx;

    const container = d3select(`#${id}`);
    const width = $(`#${id}`).parent().width() || 700;
    container.selectAll("svg").remove();
    container.selectAll("div").remove();
    const chart = container.append("svg")
        .attr("height", realHeight)
        .attr("width", "100%")
        .attr("viewbox", `-1 0 ${width} ${realHeight}`);

    const allOrfs: IOrf[] = [];
    const allBorders: ICluster[] = [];
    const allTTAs: ITTACodon[] = [];
    allOrfs.push.apply(allOrfs, region.orfs.sort(sort_biosynthetic_orfs_last));
    allBorders.push.apply(allBorders, region.clusters ? region.clusters : []);
    allTTAs.push.apply(allTTAs, region.ttaCodons ? region.ttaCodons : []);

    const idx = uniqueID++;
    verticalOffset = height / 10;
    scale = d3scaleLinear()
        .domain([selectionStart, selectionEnd])
        .range([0, width]);
    drawOrderedRegionOrfs(chart, allOrfs, allBorders, allTTAs,
                          idx, height, width, verticalOffset,
                          selectionStart, selectionEnd);
    if (region.label !== undefined) {
        chart.append("text")
            .text(region.label)
            .attr("class", "svgene-regionlabel")
            .attr("x", function() {
                const length = (this as SVGTSpanElement).getComputedTextLength();
                return width - length - 5;
             })
            .attr("y", LABEL_HEIGHT)
            .attr("font-size", LABEL_HEIGHT);
      }
    axis = d3axisBottom(scale);
    chart.append<SVGGElement>("g")
        .attr("class", "svgene-axis")
        .attr("transform", `translate(0,${(realHeight - minimapHeight - axisHeight)})`)
        .call(axis);

    createMinimap(chart, region.start, region.end, realHeight - minimapHeight / 2, minimapHeight, allOrfs, width);
    createHandlers();
}

function boundedValue(minValue: number, value: number, maxValue: number): number {
    return Math.max(minValue, Math.min(value, maxValue));
}

function createMinimap(chart: any, regionStart: number, regionEnd: number,
                       centerline: number, minimapHeight: number, orfs: IOrf[],
                       fullWidth: number): void {
    if (!displayedRegion) {
        return;
    }
    minimapScale = d3scaleLinear()
        .domain([regionStart, regionEnd])
        .range([Math.floor(fullWidth * 0.25), Math.floor(fullWidth * 0.75)])
        .nice();

    const orfHeight = minimapHeight / 4;

    chart.append("g")
        .attr("class", "svgene-minimap");
    chart.append("line")
        .attr("x1", minimapScale(regionStart))
        .attr("y1", centerline)
        .attr("x2", minimapScale(regionEnd))
        .attr("y2", centerline)
        .attr("class", "centerline");
    const minimapOrfs: d3.Selection<any, IOrf, any, any> = chart.selectAll("rect.svgene-minimap-orf")
        .data(orfs)
        .enter()
          .append("rect")
            .attr("width", (d: IOrf) => minimapScale(d.end) - minimapScale(d.start))
            .attr("height", orfHeight)
            .attr("x", (d: IOrf) => minimapScale(d.start))
            .attr("y", centerline - orfHeight / 2)
            .attr("class", (d: IOrf) => `svgene-type-${d.type} ${SELECTED_ORF_CLASS} svgene-minimap-orf`)
            .attr("id", (d: IOrf) => `svgene-minimap-orf-${tag_to_id(d.locus_tag)}`);

    const scaledRegionStart = minimapScale(regionStart);
    const scaledRegionEnd = minimapScale(regionEnd);
    const minWindowEnd = minimapScale(Math.min(regionEnd, regionStart + 1000));
    const maxWindowStart = minimapScale(Math.max(regionStart, regionEnd - 1000));

    const resizerWindow = chart.append("rect")
        .attr("x", minimapScale(regionStart))
        .attr("y", centerline - minimapHeight / 2)
        .attr("width", minimapScale(regionEnd) - minimapScale(regionStart))
        .attr("height", minimapHeight)
        .style("cursor", "grab")
        .attr("id", `svgene-minimap-window-${displayedRegion.anchor}`)
        .attr("opacity", "0.2")
        .style("fill", "blue")
        .call(d3drag<any, any>().on("drag", function() {
            if (displayedRegion === null) {
                return;
            }

            // the gap between the mouse cursor and the left side of the box
            const dx = Math.max(0, d3event.x - parseInt(d3select(this).attr("x"), 10));
            // current width of the window
            let windowWidth = parseInt(d3select(this).attr("width"), 10);
            // current left position
            const current = parseInt(d3select(this).attr("x"), 10);
            // expected new left position
            const newPosition = current + d3event.dx;
            // left boundary
            let x1: number = boundedValue(scaledRegionStart, newPosition, maxWindowStart);
            if (newPosition < scaledRegionStart) {
                windowWidth = Math.max(minWindowEnd - scaledRegionStart, windowWidth - (scaledRegionStart - newPosition));
            } else if (newPosition + windowWidth > scaledRegionEnd) {
                x1 = Math.min(newPosition, maxWindowStart);
                windowWidth = scaledRegionEnd - x1;
            } // else window width is unchanged
            x1 = boundedValue(scaledRegionStart, x1, maxWindowStart);
            const x2 = Math.max(minWindowEnd, x1 + windowWidth);
            d3select(this).attr("x", x1).attr("width", windowWidth);
            d3select(`#svgene-minimap-grabber-a-${displayedRegion.anchor}`).attr("x", x1);
            d3select(`#svgene-minimap-grabber-b-${displayedRegion.anchor}`).attr("x", x2);
            change_view(minimapScale.invert(x1), minimapScale.invert(x2), true);
        }));

    const leftResizer = chart.append("rect")
        .attr("x", minimapScale(regionStart))
        .attr("y", centerline - minimapHeight / 2)
        .attr("id", `svgene-minimap-grabber-a-${displayedRegion.anchor}`)
        .attr("width", 2)
        .attr("height", minimapHeight)
        .style("cursor", "ew-resize")
        .call(d3drag<any, any>().on("drag", function(d, i) {
            if (!displayedRegion) {
                return;
            }
            const x2: number = parseInt(d3select(`#svgene-minimap-grabber-b-${displayedRegion.anchor}`).attr("x"), 10);
            const x1: number = Math.min(minimapScale(minimapScale.invert(x2) - 1000), scaledRegionEnd,
                                        Math.max(d3event.x, scaledRegionStart));
            d3select(this)
                .transition().duration(10)
                .attr("x", x1);
            d3select(`#svgene-minimap-window-${displayedRegion.anchor}`)
                .transition().duration(10)
                .attr("x", x1)
                .attr("width", x2 - x1);

            change_view(minimapScale.invert(x1), minimapScale.invert(x2), true);
        }))
        ;

    const rightResizer = chart.append("rect")
        .attr("x", minimapScale(regionEnd))
        .attr("y", centerline - minimapHeight / 2)
        .attr("id", `svgene-minimap-grabber-b-${displayedRegion.anchor}`)
        .attr("width", 2)
        .attr("height", minimapHeight)
        .style("cursor", "ew-resize")
        .call(d3drag<any, any>().on("drag", function(d, i) {
            if (!displayedRegion) {
                return;
            }
            const x1: number = parseInt(d3select(`#svgene-minimap-grabber-a-${displayedRegion.anchor}`).attr("x"), 10);
            const x2: number = Math.max(minimapScale(minimapScale.invert(x1) + 1000),
                                        minWindowEnd,
                                        Math.min(d3event.x, scaledRegionEnd));
            d3select(this)
                .transition().duration(10)
                .attr("x", x2);
            d3select(`#svgene-minimap-window-${displayedRegion.anchor}`)
                .transition().duration(10)
                .attr("width", x2 - x1);

            change_view(minimapScale.invert(x1), minimapScale.invert(x2), true);
        }))
        ;
}

function sort_biosynthetic_orfs_last(a: IOrf, b: IOrf): number {
    if ((a.type !== "biosynthetic" && b.type !== "biosynthetic") ||
            (a.type === "biosynthetic" && b.type === "biosynthetic")) {
        return a.start - b.start;
    }
    if (a.type === "biosynthetic") {
        return 1;
    }
    return -1;
}

function tag_to_id(tag: string): string {
    return tag.replace(/(:|\.)/g, "-").replace(/-svgeneorf/g, "_orf");
}

function multi_select(geneElement: JQuery<HTMLElement>): void {
    // use the base HTMLElement here because JQuery falls over with hasClass()
    if (geneElement[0].classList.contains(SELECTED_ORF_CLASS)) {
        deselectOrfs(geneElement);
        // if it was the last one, reselect everything
        if ($(`.${SELECTED_ORF_CLASS}`).length === 0) {
            selectOrfs();
        }
    } else {
        // if it's the first, deselect everything else first
        if ($(`.${SELECTED_ORF_CLASS}`).length === 0) {
            deselectOrfs();
        }
        selectOrfs(geneElement);
    }
    toggleCDSCollapserMatchingElement(geneElement, "cds");
}

function tooltip_handler(this: HTMLElement, ev: JQuery.Event): void {
    if (!displayedRegion) {
        return;
    }
    // if a legend button is active, remove that
    $(".legend-selected").removeClass("legend-selected");

    if (ev.ctrlKey) {
        multi_select($(this));
        return;
    }

    const node: d3.Selection<any, IOrf, any, any> = d3selectAll($(this).toArray());
    const data: IOrf = node.datum();
    const panelContent = $(`.focus-panel-content-${displayedRegion.anchor}`);
    panelContent.html(data.description).find(".collapser").click(toggleCollapserHandler);
    $(".clipboard-copy", panelContent).off("click").click(copyToClipboard);
    if (node.classed(SELECTED_ORF_CLASS) && $(`.svgene-orf.${SELECTED_ORF_CLASS}`).length === 1) {
        selectOrfs();
    } else {
        deselectOrfs();
        selectOrfs($(this));
    }
    toggleCDSCollapserMatchingElement($(this), "cds");
}

function createHandlers(): void {
    $(".svgene-orf").mouseover(function(e) {
        let id = $(this).attr("id");
        if (typeof id === "undefined") {
            return;
        }
        id = id.replace("-svgeneorf", "-label");
        $("#" + id).show();
    }).mouseout(function(e) {
        let id = $(this).attr("id");
        if (typeof id === "undefined") {
            return;
        }
        id = id.replace("-svgeneorf", "-label");
        $("#" + id).hide();
    }).click(tooltip_handler);
    $(".svgene-textarea").click((event: JQuery.Event) => event.stopPropagation());
    $(".legend-selector").unbind("click").click(legend_selector);
    $(".zoom-in").unbind("click").click(zoom_to_selection);
    $(".zoom-reset").unbind("click").click(reset_zoom);
    if (uniqueID === 1) {
        $(document).keyup(
            (event: JQuery.Event) => {
                const key = event.keyCode;
                if (key === 82) {  // r
                    reset_zoom(event);
                } else if (key === 90) {  // z
                    zoom_to_selection(event);
                }
            },
        );
    }
}

function toggleSuperclusterCollapsers(cluster: ICluster): void {
    // hide any open supercluster expanders
    toggleCollapser($(".collapser-level-supercluster.expanded"));
    // then expand relevant expanders
    const target = cluster.product.split(":")[0].split(" ")[1];
    toggleCollapser($(`.collapser-level-supercluster.collapser-target-SC${target}`));
}

function toggleCDSCollapserMatchingElement(geneElement: JQuery<HTMLElement>, level: string): void {
    const node: d3.Selection<any, IOrf, any, any> = d3selectAll(geneElement.toArray());
    const data: IOrf = node.datum();
    toggleCollapser($(`.collapser-target-${tag_to_id(data.locus_tag)}.collapser-level-${level}`));
}

function hideCDSLevelCollapsers(): void {
    toggleCollapser($(".collapser-level-cds.expanded"));
}

function select_by_range(start: number, end: number): void {
    $(".legend-selected").removeClass("legend-selected");
    $(".svgene-orf").each(function(index) {
        const node: d3.Selection<any, IOrf, any, any> = d3selectAll($(this).toArray());
        const data: IOrf = node.datum();
        if (start <= data.start && data.end <= end) {
            selectOrfs($(this));
            toggleCDSCollapserMatchingElement($(this), "supercluster");
            toggleCDSCollapserMatchingElement($(this), "cluster");
        }
    });
}

function changeOrfSelectedState(orfs: JQuery<HTMLElement>, selected: boolean) {
    const opacity = selected ? "1" : "0.5";
    const d3orfs: d3.Selection<any, IOrf, any, any> = d3selectAll(orfs.toArray());
    d3orfs.attr("opacity", opacity)
        .classed(SELECTED_ORF_CLASS, selected)
        .each((data: IOrf) => {
            d3selectAll(`#svgene-minimap-orf-${tag_to_id(data.locus_tag)}`)
                .attr("opacity", opacity)
                .classed(SELECTED_ORF_CLASS, selected);
            // update domains related to this orf
            if (selected) {  // not a toggle due to default state sync
                $(`#${locusToFullId(data.locus_tag)}-domains`).show();
            } else {
                $(`#${locusToFullId(data.locus_tag)}-domains`).hide();
            }
        });
}

function selectOrfs(orfs?: JQuery<HTMLElement>) {
    if (typeof orfs === "undefined") {
        orfs = $(".svgene-orf, .svgene-minimap-orf");
    }
    changeOrfSelectedState(orfs, true);
}

function deselectOrfs(orfs?: JQuery<HTMLElement>) {
    if (typeof orfs === "undefined") {
        orfs = $(`.${SELECTED_ORF_CLASS}`);
    }
    changeOrfSelectedState(orfs, false);
}

function legend_selector(this: HTMLElement, event: JQuery.Event) {
    const originalID = $(this).attr("data-id");
    if (typeof originalID === "undefined") {
        return;
    }
    let target = ".contains-tta-codon";
    if (originalID !== "legend-tta-codon") {
        target = `.${originalID.replace("legend-", "svgene-")}`;
    }

    if ($(this).hasClass("legend-selected")) {
        $(this).removeClass("legend-selected");
        deselectOrfs($(target));
        if ($(".legend-selected").length === 0) {
            selectOrfs();
        }
        return;
    }
    if (!event.ctrlKey || $(".legend-selected").length === 0) {
        $(".legend-selected").removeClass("legend-selected");
        deselectOrfs();
    }
    $(this).addClass("legend-selected");
    selectOrfs($(target));
}

function zoom_to_selection(event: JQuery.Event) {
    let start = -1;
    let end = -1;
    $(`.${SELECTED_ORF_CLASS}`).each(function(index) {
        const node: d3.Selection<any, IOrf, any, any> = d3selectAll($(this).toArray());
        const data: IOrf = node.datum();
        if (start === -1) {
            start = Math.min(data.start, data.end);
        } else {
            start = Math.min(start, data.start, data.end);
        }
        if (end === -1) {
            end = Math.max(data.start, data.end);
        } else {
            end = Math.max(end, data.start, data.end);
        }
    });
    if (start === -1 || end === -1) {
        return;
    }
    change_view(start, end);
}

function change_view(start: number, end: number, changedByMinimap?: boolean) {
    if (!displayedRegion) {
        return;
    }
    let duration = 0;
    if (typeof changedByMinimap === "undefined") {
        changedByMinimap = false;
        duration = 500;
    }
    start = start - 1;
    end = end + 1;
    scale.domain([start, end]);
    const midpoint = start + (end - start) / 2;

    const orfs: d3.Selection<any, IOrf, any, any> = d3selectAll(".svgene-orf,.svgene-orf-bg");
    orfs.transition().duration(duration)
        .attr("points", (d) => geneArrowPoints(d));

    const orfLabels: d3.Selection<any, IOrf, any, any> = d3selectAll(".svgene-locustag");
    orfLabels.transition().duration(duration)
        .attr("x", (d: IOrf) => d.start < midpoint ? scale(d.start) : scale(d.end))
        .attr("text-anchor", (d: IOrf) => d.start < midpoint ? "start" : "end");

    const interactionZones: d3.Selection<any, ICluster, any, any> = d3selectAll(".cluster-background");
    interactionZones.transition().duration(duration)
        .attr("width", (d) => scale(d.neighbouring_end) - scale(d.neighbouring_start))
        .attr("x", (d) => scale(d.neighbouring_start));
    const clusterBoxes: d3.Selection<any, ICluster, any, any> = d3selectAll(".cluster-core");
    clusterBoxes.transition().duration(duration)
        .attr("width", (d) => scale(d.end) - scale(d.start))
        .attr("x", (d) => scale(d.start));
    const clusterLines: d3.Selection<any, ICluster, any, any> = d3selectAll(".cluster-line");
    clusterLines.transition().duration(duration)
        .attr("x1", (d) => scale(d.neighbouring_start))
        .attr("x2", (d) => scale(d.neighbouring_end));
    const clusterLabels: d3.Selection<SVGTextElement, ICluster, any, any> = d3selectAll(".clusterlabel");
    clusterLabels.transition().duration(duration)
        .attr("x", (d): number => scale((Math.max(d.start, start + 1) + Math.min(d.end, end - 1)) / 2));
    const ttaCodons: d3.Selection<SVGElement, ITTACodon, any, any> = d3selectAll(".svgene-tta-codon");
    ttaCodons.transition().duration(duration)
        .attr("points", (d: ITTACodon) => ttaCodonPoints(d, HEIGHT, orfY, verticalOffset));

    if (axis !== null) {
        d3select<any, any>(".svgene-axis")
            .transition().duration(duration)
            .call(axis);
    }

    if (!changedByMinimap) {
        if ($(`.${SELECTED_ORF_CLASS}`).length === 0) {
            selectOrfs();
        }
        const x1 = minimapScale(start);
        const x2 = minimapScale(end);
        d3select(`#svgene-minimap-grabber-a-${displayedRegion.anchor}`)
            .transition().duration(duration)
            .attr("x", x1);
        d3select(`#svgene-minimap-grabber-b-${displayedRegion.anchor}`)
            .transition().duration(duration)
            .attr("x", x2);
        d3select(`#svgene-minimap-window-${displayedRegion.anchor}`)
            .transition().duration(duration)
            .attr("x", x1)
            .attr("width", x2 - x1);
    }
}

function reset_zoom(this: void, event: JQuery.Event) {
    if (displayedRegion === null) {
        return;
    }
    $(".legend-selected").removeClass("legend-selected");
    selectOrfs();
    change_view(displayedRegion.start, displayedRegion.end);
    hideCDSLevelCollapsers();
}

let axis: d3.Axis<any> | null = null;
let minimapScale: d3.ScaleLinear<number, number> = d3scaleLinear().domain([0, 100]).range([0, 100]);
let verticalOffset: number = 0;
let orfY: number = 0;
let displayedRegion: IRegion | null = null;
let scale: d3.ScaleLinear<number, number> = d3scaleLinear().domain([0, 100]).range([0, 100]);
let uniqueID: number = 0;
