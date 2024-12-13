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
import {axisBottom as d3axisBottom, AxisScale} from "d3-axis";
import {drag as d3drag} from "d3-drag";
import {path} from "d3-path";
import {ScaleLinear, scaleLinear as d3scaleLinear} from "d3-scale";
import {event as d3event, select as d3select, selectAll as d3selectAll} from "d3-selection";
import "d3-transition";  // modifies select and selectAll

import {Area} from "./classes/area.js";
import {addCircularMarkerGroup, CircularMarkerInfo} from "./classes/circular_marker.js";
import {Coordinates} from "./classes/coordinates.js";
import {Dimensions} from "./classes/dimensions.js";
import {Orf} from "./classes/orf.js";
import {IBindingSite, IOrf, IRegion, ISites, ISource, ITTACodon} from "./classes/pythonStructures.js";
import {Transform} from "./classes/transform.js";
import {copyToClipboard} from "./clipboard.js";
import {toggleCollapser, toggleCollapserHandler} from "./collapsers.js";
import {replaceWildcards} from "./wildcards.js";

let HEIGHT = 100;
const LABEL_HEIGHT = 14;
const VERSION: string = "0.0.1";

const BAR_GROUP_CLASS = "cluster-bar-group";
const ORF_GROUP_CLASS = "svgeneorf-group";
const SELECTED_ORF_CLASS = "svgene-selected-orf";

class SourceInfo {
    public sourceData: ISource;
    public scale: d3.ScaleLinear<number, number>;
    public axis: d3.Axis<any>;
    public wrapPoint: number;
    public y: number;

    constructor(source: ISource, sourceScale: d3.ScaleLinear<number, number>,
                sourceAxis: d3.Axis<any>, wrapPoint: number, y: number) {
        this.sourceData = source;
        this.scale = sourceScale;
        this.axis = sourceAxis;
        this.wrapPoint = wrapPoint;
        this.y = y;
    }
}

/**
 * Selects all ORFs in the visualisation by the locus tags/names used in the data.
 *
 * @param tags - the locus tags of the ORFs to select
 * @param multiSelect - whether the existing selection should be kept selected
 */
export function selectOrfsByLoci(tags: string[], multiSelect: boolean = false) {
    if (!displayedRegion) {
        return;
    }
    if (tags.length < 1) {
        return;
    }
    let id = `#${locusToFullId(tags[0])}-${ORF_GROUP_CLASS}`;
    let selection = $(id);
    let node: d3.Selection<any, Orf, any, any> = d3selectAll(id);
    let data: Orf = node.datum();
    selection = selection.add($(`#${locusToFullId(data.locusTag)}`));
    if (data.otherSide !== undefined) {
        selection = selection.add($(`#${locusToFullId(data.otherSide.locusTag)}-${ORF_GROUP_CLASS}`));
    }
    for (const tag of tags.slice(1)) {
        id = `#${locusToFullId(tag)}-${ORF_GROUP_CLASS}`;
        selection = selection.add(id);

        node = d3selectAll(id);
        data = node.datum();
        if (data.otherSide !== undefined) {
            selection = selection.add(`#${locusToFullId(data.otherSide.locusTag)}-${ORF_GROUP_CLASS}`);
        }
    }
    if (multiSelect) {
        multi_select(selection);
    } else {
        cdsSelector(selection, tags.length > 1);
    }
}

/**
 * Converts an ORF locus tag/name in the data to the identifier used in the visualisation.
 *
 * @param locusTag - the locus tag to convert
 */
export function locusToFullId(locusTag: string): string {
    if (!displayedRegion) {
        return `${tag_to_id(locusTag)}`;
    }
    return `u${uniqueID - 1}-region${displayedRegion.idx}-${tag_to_id(locusTag)}`;
}

/**
 * Converts an ORF identifier used in the visualistion to the locus tag/name of the
 * relevant ORF.
 *
 * @param identifier - The element identifier to convert
 */
function fullIdToLocus(identifier: string): string {
    // IDs are in the form "u<some number>-region<some number>-<locus>-svgeneorf"
    return identifier.split(/-/)[2];
}

/**
 * Clears all current selected ORFs, effectively selecting all of them.
 */
export function clearSelectedOrfs() {
    selectOrfs();
}

/**
 * Returns a partial SVG path string that will draw the shape of a gene arrow.
 *
 * @param orf - The ORF to build from
 */
function geneArrowPoints(orf: Orf, pathNotPoly?: boolean): string {
    const upper: number = orfY + LABEL_HEIGHT + verticalOffset;
    const lower: number = orfY + LABEL_HEIGHT + HEIGHT - verticalOffset;
    const middle: number = orfY + LABEL_HEIGHT + (HEIGHT / 2);
    let asString: string = "";
    if (orf.strand === 1) {
        const start: number = scale(orf.start);
        const boxEnd: number = Math.max(scale(orf.end) - (2 * verticalOffset), start);
        const pointEnd: number = scale(orf.end);
        if (pathNotPoly) {
            const detail = path();
            detail.moveTo(start, upper);
            detail.lineTo(boxEnd, upper);
            detail.lineTo(pointEnd, middle);
            detail.lineTo(boxEnd, lower);
            detail.lineTo(start, lower);
            asString = detail.toString();
        } else {
            asString = `${start},${upper} ${boxEnd},${upper} ${pointEnd},${middle} ${boxEnd},${lower} ${start},${lower}`;
        }
    } else if (orf.strand === -1) {
        const pointStart = scale(orf.start);
        const end = scale(orf.end);
        const boxStart = Math.min(scale(orf.start) + (2 * verticalOffset), end);
        if (pathNotPoly) {
            const detail = path();
            if (orf.isSplit()) {
                detail.moveTo(end, upper);
                detail.lineTo(boxStart, upper);
                detail.lineTo(pointStart, middle);
                detail.lineTo(boxStart, lower);
                detail.lineTo(end, lower);
            } else {
                detail.moveTo(pointStart, middle);
                detail.lineTo(boxStart, upper);
                detail.lineTo(end, upper);
                detail.lineTo(end, lower);
                detail.lineTo(boxStart, lower);
            }
            asString = detail.toString();
        } else {
            asString = `${pointStart},${middle} ${boxStart},${upper} ${end},${upper} ${end},${lower} ${boxStart},${lower}`;
        }
    } else {
        const start = scale(orf.start);
        const end = scale(orf.end);
        if (pathNotPoly) {
            const detail = path();
            detail.moveTo(start, upper);
            detail.lineTo(end, upper);
            detail.lineTo(end, lower);
            detail.lineTo(start, lower);
            asString = detail.toString();
        } else {
            asString = `${start},${upper} ${end},${upper} ${end},${lower} ${start},${lower}`;
        }
    }
    // if a path is requested and it isn't interrupted by the origin, close the path
    if (pathNotPoly && !orf.isSplit()) {
        asString += "Z";
    }
    return asString;
}

/**
 * Returns a partial SVG path string that will draw the shape of a TTA codon element.
 *
 * @param codon - The codon information from the data
 * @param height - The height of the indicator
 * @param offset - The Y coordinate to use for the top of the indicator
 * @param border -
 */
function ttaCodonPoints(codon: ITTACodon, height: number, offset: number, border: number): string {
    const tipY = offset + LABEL_HEIGHT + height;
    const bottom = offset + (2 * LABEL_HEIGHT) + height - border;
    const tipX = Math.floor(scale((codon.start + codon.end) / 2));
    return `${tipX},${tipY} ${tipX - 5},${bottom} ${tipX + 5},${bottom}`;
}

/**
 *
 *
 * @param chart - the SVG DOM element
 * @param allOrfs - the ORF JSON objects created in python
 * @param borders - the ClusterBorder JSON objects created in python
 * @param sites - the various marker sites generated by python
 * @param scale - the d3 linearScale used to size the SVG appropriately
 * @param idx - the record index
 * @param height - the draw height for ORFs
 * @param width - the draw width of the ORF centerline
 * @param offset -
 * @param selectionStart - the start position of the view
 * @param selectionEnd - the end position of the view
 */
function drawOrderedRegionOrfs(chart: any, allOrfs: Orf[], borders: Area[], sites: ISites,
                               idx: number, imageHeight: number, width: number, offset: number,
                               selectionStart: number, selectionEnd: number, orfHeight: number): void {
    if (displayedRegion === null) {
      return;
    }
    const regionIndex: number = displayedRegion.idx;
    orfY = Math.max.apply(Math, borders.map((border) => border.height)) * 12 + LABEL_HEIGHT;
    HEIGHT = orfHeight;
    // ORF centerline
    const centerlineY = orfY + LABEL_HEIGHT + orfHeight / 2;
    chart.append("line")
    .attr("x1", scale(displayedRegion.start))
    .attr("y1", centerlineY)
    .attr("x2", scale(displayedRegion.end))
    .attr("y2", centerlineY)
    .attr("class", "centerline");

    // clusters
    const barSize = orfHeight / 2;
    const verticalBarGap = orfHeight / 10;
    const clusterBars: d3.Selection<SVGGElement, Area, any, any> = chart.selectAll(`g.${BAR_GROUP_CLASS}`)
        .data(borders)
        .enter().append("g").attr("class", (d: Area) => `${BAR_GROUP_CLASS} ${d.css}`)
        .on("click", (d: Area) => {
            if ($(`.${SELECTED_ORF_CLASS}`).length === allOrfs.length || !(d3event.ctrlKey || d3event.metaKey)) {
                deselectOrfs();
            }
            select_by_range(d.neighbouringStart, d.neighbouringEnd);
            toggleCandidateClusterCollapsers(d);
            if (d.otherSide !== undefined) {
                select_by_range(d.otherSide.neighbouringStart, d.otherSide.neighbouringEnd);
            }
        })
        .on("dblclick", (d: Area) => {
            select_by_range(d.neighbouringStart, d.neighbouringEnd);
            toggleCandidateClusterCollapsers(d);
            if (d.otherSide !== undefined) {
                select_by_range(d.otherSide.neighbouringStart, d.otherSide.neighbouringEnd);
                if (displayedRegion !== null) {
                    change_view(displayedRegion.start, displayedRegion.end);
                }
            } else {
                change_view(d.neighbouringStart, d.neighbouringEnd);
            }
        });

    // background
    clusterBars.filter((d) => d.kind === "protocluster").append("rect")
        .attr("width", (d) => scale(d.neighbouringEnd) - scale(d.neighbouringStart)
                              - (d.splitsInNeighbourhood() && d.neighbouringStart === 0 ? 1 : 0))
        .attr("height", barSize)
        .attr("x", (d) => scale(d.neighbouringStart) + (d.splitsInNeighbourhood() && d.neighbouringStart === 0 ? 1 : 0))
        .attr("y", (d) => d.height * (barSize + verticalBarGap) + offset)
        .attr("opacity", "0.5")
        .attr("class", (d) => `cluster-background ${d.product} ${d.category}`)
        .style("stroke-width", "0");
    // extent lines
    clusterBars.filter((d) => d.kind === "protocluster").append("line")
        .attr("x1", (d) => scale(d.neighbouringStart) + d.getWidthOffset())
        .attr("y1", (d) => d.height * (barSize + verticalBarGap) + offset + barSize / 2)
        .attr("x2", (d) => scale(d.neighbouringEnd))
        .attr("y2", (d) => d.height * (barSize + verticalBarGap) + offset + barSize / 2)
        .attr("class", "cluster-line");
    // rect containing first and last ORF triggering border detection
    clusterBars.filter((d) => d.kind !== "protocluster" || d.containsCore()).append("rect")
        .attr("width", (d) => scale(d.end) - scale(d.start) - d.getWidthOffset())
        .attr("height", barSize)
        // start a tiny bit earlier for neighbourhood splits, due to lack of stroke
        .attr("x", (d) => scale(d.start))
        .attr("y", (d) => d.height * (barSize + verticalBarGap) + offset)
        .attr("class", (d) => (d.kind === "subregion"
                                 ? (d.prefix
                                    ? "cluster-core"
                                    : `cluster-core svgene-border-${d.tool}`)
                                 : `cluster-core ${d.product} ${d.category}`))
        .style("stroke", "black");

    if (borders.some((border) => border.otherSide !== undefined)) {
        // mask off the extra area on both sides
        const dimensions = new Dimensions(width, imageHeight);
        const splitAreas = clusterBars.filter((d) => d.otherSide !== undefined)
            .each(function(d: Area) {
                const y = d.height * (barSize + verticalBarGap) + offset;
                let product = d.product;
                let category = d.category;
                if (d.otherSide !== undefined) {
                    if (product === "") {
                        product = d.otherSide.product;
                    }
                    if (category === "") {
                        category = d.otherSide.category;
                    }
                }
                const info = new CircularMarkerInfo(dimensions, 0, y, `${product} ${category}`);
                const backTranslation = new Coordinates(1, 0);

                let elementClass = `left-circular-marker cluster-core ${product} ${category}`;
                d.transform = new Transform(1, 1, -1, y);

                if (d.splitsInNeighbourhood()) {
                    if (d.neighbouringStart === 0) { // this area is on the left
                        info.barEnd = scale(d.neighbouringStart);
                        d.transform.scale.x = -1;
                        d.transform.translate.x = -2 * scale(d.neighbouringStart) - 1;
                    } else {  // this area is on the right
                        elementClass = elementClass.replace(/left/gi, "right");
                        info.barEnd = scale(d.neighbouringEnd) + 1;
                    }
                } else {
                    if (d.neighbouringStart === 0) {  // truncated on the left
                        info.barEnd = scale(d.neighbouringStart);
                        d.transform.scale.x = -1;
                        d.transform.translate.x = -2 * scale(d.neighbouringStart) - 1;
                    } else {  // truncated on the right
                        elementClass = elementClass.replace(/left/gi, "right");
                        info.barEnd = scale(d.neighbouringEnd);
                    }
                }
                const marker = addCircularMarkerGroup(d3select(this), info, barSize, backTranslation, d.splitsInNeighbourhood())
                    .style("transform", d.transform.toStyle())
                    .attr("class", `${d3select(this).attr("class")} ${elementClass}`);
                if (d.splitsInNeighbourhood()) {
                    marker
                        .attr("opacity", 0.5);
                }
            });
    }

    // cluster name
    clusterBars.append("text")
        .attr("x", (d: Area) => scale((d.start + d.end) / 2))
        .attr("y", (d: Area) => (d.kind === "protocluster"
                                            ? ((d.height - 1) * (barSize + verticalBarGap) - verticalBarGap + barSize + offset)
                                            : ((d.height) * (barSize + verticalBarGap) - verticalBarGap + barSize + offset)))
        .style("font-size", "xx-small")
        .attr("class", "clusterlabel")
        .attr("text-anchor", "middle")
        .style("pointer-events", "none")
        .text((d: Area) => (d.prefix + d.product.replace("_", " ")));

    // binding sites (must be drawn before ORFs to avoid overlaying them)
    const bindingSiteRadius = 3;
    const bindingPinY = centerlineY - orfHeight / 2 - bindingSiteRadius * 1.5;
    const bindingSiteElements: d3.Selection<SVGGElement, IBindingSite, any, any> = chart.selectAll("g.svgene-binding-site")
        .data(sites.bindingSites)
        .enter().append("g")
        .attr("class", "svgene-binding-site");
    bindingSiteElements.append("line")
        .attr("x1", (d: IBindingSite) => scale(d.loc + d.len / 2))
        .attr("x2", (d: IBindingSite) => scale(d.loc + d.len / 2))
        .attr("y1", centerlineY)
        .attr("y2", bindingPinY);
    bindingSiteElements.append("circle")
        .attr("cx", (d: IBindingSite) => scale(d.loc + d.len / 2))
        .attr("cy", bindingPinY)
        .attr("r", bindingSiteRadius);

    // ORFs
    const orfs: d3.Selection<SVGGElement, Orf, any, any> = chart.selectAll(`g.${ORF_GROUP_CLASS}`)
        .data(allOrfs)
        .enter().append("g")
            .attr("class", (d: Orf) => `${ORF_GROUP_CLASS} ${SELECTED_ORF_CLASS} svgene-type-${d.type}-group`)
            .attr("id", (d: Orf) => `u${idx}-region${regionIndex}-${tag_to_id(d.locusTag)}-${ORF_GROUP_CLASS}`);
    // hide the ORF centerline
    orfs.append("polygon")
        .attr("points", (d) => geneArrowPoints(d))
        .attr("class", "svgene-orf-bg")
        .attr("id", (d) => `u${idx}-region${regionIndex}-${tag_to_id(d.locusTag)}-svgeneorf-bg`)
        .style("fill", "white");
    // draw the ORF itself
    orfs.append("polygon")
        .attr("points", (d) => geneArrowPoints(d))
        .attr("class", (d) => `svgene-type-${d.type} svgene-orf ${SELECTED_ORF_CLASS}`)
        .attr("id", (d) => `u${idx}-region${regionIndex}-${tag_to_id(d.locusTag)}-svgeneorf`)
        .style("stroke", "none")
        .style("stroke-width", "0")
        .attr("opacity", "1");
    // add the stroke path
    orfs.append("path")
        .attr("d", (d) => geneArrowPoints(d, true))
        .attr("class", (d) => `svgene-type-${d.type} svgene-orf-border ${SELECTED_ORF_CLASS}-border`)
        .attr("opacity", "1");

    orfs.filter((d: Orf) => d.isSplit()).each(function(d) {
        const dimensions = new Dimensions(width, imageHeight);
        const y = orfY + LABEL_HEIGHT + verticalOffset;
        const verticalSize = orfY + LABEL_HEIGHT + HEIGHT - verticalOffset - y;
        const info = new CircularMarkerInfo(dimensions, 0, y, d.type);
        const backTranslation = new Coordinates(1, 2);

        let elementClass = `circular-marker circular-marker-${d.getLocus()} left-circular-marker svgene-type-${d.type}`;
        d.transform = new Transform(1, 1, 0, y);

        if (d.start <= 1) { // post-origin side
            info.barEnd = scale(d.start);
            d.transform.scale.x = -1;
            d.transform.translate.x = -2 * scale(d.start);
        } else {  // pre-origin side
            elementClass = elementClass.replace(/left/gi, "right");
            info.barEnd = scale(d.end);
        }
        const marker = addCircularMarkerGroup(d3select(this), info, verticalSize, backTranslation)
            .style("transform", d.transform.toStyle())
            .attr("class", `${d3select(this).attr("class")} ${elementClass}`);
    });

    // Resistance markers
    const resistBarY = orfY + LABEL_HEIGHT + orfHeight + 2;
    const resistBarHeight = 7;
    const resistanceOrfs: d3.Selection<SVGElement, Orf, any, any> = chart.selectAll("rect.svgene-resist")
        .data(allOrfs.filter((d: Orf) => d.resistance))
        .enter().append("rect")
        .attr("class", "svgene-resistance")
        .attr("width", (d: Orf) => (scale(d.end) - scale(d.start)))
        .attr("height", resistBarHeight)
        .attr("x", (d: Orf) => scale(d.start))
        .attr("y", resistBarY);

    // mark ORFs that have resistance markers
    for (const orf of allOrfs.filter((d: Orf) => d.resistance)) {
        const id = `#u${idx}-region${regionIndex}-${tag_to_id(orf.locusTag)}-svgeneorf`;
        const orfElement: d3.Selection<SVGElement, Orf, any, any> = d3select(id);
        orfElement.classed("svgene-resistance-orf", true);
    }

    // TTA codons
    const ttaCodonElements: d3.Selection<SVGGElement, ITTACodon, any, any> = chart.selectAll("polyline.svgene-tta-codon")
        .data(sites.ttaCodons)
        .enter().append("polyline")
        .attr("points", (d: ITTACodon) => ttaCodonPoints(d, orfHeight, orfY, offset))
        .attr("class", "svgene-tta-codon");

    // ORF labels
    const locusTags: d3.Selection<SVGGElement, Orf, any, any> = chart.selectAll("text.svgene-locustag")
        .data(allOrfs)
        .enter().append("g")
        .attr("class", "svgene-locustag")
        .attr("id", (d: Orf) => `u${idx}-region${regionIndex}-${tag_to_id(d.locusTag)}-label`);
    // to ensure they always overlay any other information, add a background
    locusTags.append("rect")
        .attr("x", (d: Orf) => scale(d.start) < width / 2 ? scale(d.start) : scale(d.end))
        .attr("y", orfY)
        .attr("width", (d: Orf) => d.getLocus().length * 10)
        .attr("height", LABEL_HEIGHT)
        .attr("class", "svgene-locustag-background");
    locusTags.append("text")
        // to prevent truncating locus tags, right-align labels after the midpoint
        .attr("x", (d: Orf) => scale(d.start) < width / 2 ? scale(d.start) : scale(d.end))
        .attr("text-anchor", (d: Orf) => scale(d.start) < width / 2 ? "start" : "end")
        .attr("y", orfY + LABEL_HEIGHT)
        .text((d: Orf) => d.getLocus());

    // mark ORFs that contain TTA codons
    for (const tta of sites.ttaCodons) {
        for (const locus of tta.containedBy) {
            const id = `#u${idx}-region${regionIndex}-${tag_to_id(locus)}-${ORF_GROUP_CLASS}`;
            const orf: d3.Selection<SVGElement, Orf, any, any> = d3select(id);
            orf.classed("contains-tta-codon", true);
        }
    }
}

/**
 * Draws source visualations for inputs with multiple sources
 *
 * @param chart - the SVG DOM element
 * @param sources - the source structures to draw
 * @param region - the region data
 * @param height - the height of the source elements
 * @param width - the width of the source elements
 * @param y - the Y coordinate to use for ?
 * @param selectionStart - the start position of the view
 * @param selectionEnd - the end position of the view
 */
function drawSources(chart: any, sources: ISource[], region: IRegion, height: number, width: number, y: number,
                     selectionStart: number, selectionEnd: number) {
    const spacers: d3.Selection<SVGGElement, ISource, any, any> = chart.selectAll("rect.svgene-source-marker")
        .data(sources.slice(0, -1))
        .enter();
    spacers.append("rect")
        .attr("width", (d: ISource, i: number) => Math.max(1, scale(sources[i + 1].recordStart) - scale(d.recordEnd)))
        .attr("height", y - height)
        .attr("x", (d: ISource) => scale(d.recordEnd))
        .attr("y", 0)
        .attr("class", "svgene-source-marker");

    const tickCount = 10;
    let totalLength = 0;
    for (const source of sources) {
        totalLength += source.recordEnd - source.recordStart;
    }
    // clear the existing sources so they don't duplicate next redraw
    sourceInfo.length = 0;

    let index = 0;
    for (const source of sources) {
        // handle axial coordinate resets by converting from virtual/overflow coordinates
        // back to the real coordinates
        const wrapPoint = (index === 0 ? source.recordEnd + 1 : sources[index - 1].recordEnd);
        index += 1;

        // create the per-section scales and axes
        const sourceScale = d3scaleLinear()
            .domain([source.recordStart % wrapPoint, source.recordEnd % wrapPoint])
            .range([scale(source.recordStart), scale(source.recordEnd)]);
        const sourceAxis = d3axisBottom(sourceScale);

        // attempt to have a proportional amount of ticks in each subaxis
        const proportionateLength = (source.recordEnd - source.recordStart) / totalLength;
        const ticksForThis = Math.max(2, Math.floor(tickCount * proportionateLength) * 2);
        sourceScale.ticks(ticksForThis);
        sourceAxis.ticks(ticksForThis);

        // instantiate an object that we can bind to the SVG element to make transitions easier
        sourceInfo.push(new SourceInfo(source, sourceScale, sourceAxis, wrapPoint, (y - height) / 0.8));
        // then draw/append the element in the SVG
        chart.selectAll("g.svgene-subaxis")
            .data(sourceInfo)
            .enter()
            .append("g")
                .attr("class", "svgene-subaxis")
                .attr("transform", `translate(0,${(y - height / 0.8)})`)
                .call(sourceAxis);
    }
}

function pairBorders(borders: Area[]): boolean {
    const mapping = new Map();
    for (const border of borders) {
        if (border.group) {
            const existing = mapping.get(border.group) ?? [];
            existing.push(border);
            mapping.set(border.group, existing);
        }
    }
    for (const group of mapping.values()) {
        group[0].otherSide = group[1];
        group[1].otherSide = group[0];
    }
    return mapping.size > 0;
}

function pairOrfs(orfs: Orf[]): boolean {
    const mapping = new Map();
    for (const orf of orfs) {
        if (orf.group) {
            const existing = mapping.get(orf.group) ?? [];
            existing.push(orf);
            mapping.set(orf.group, existing);
        }
    }
    for (const group of mapping.values()) {
        group[0].otherSide = group[1];
        group[1].otherSide = group[0];
    }
    return mapping.size > 0;
}

/**
 * Draws an entire region, creating an SVG element
 *
 * @param id - the identifier of the SVG's parent container
 * @param regionToDraw - the region data
 * @param height - the height of the SVG
 * @param width - the width of the SVG
 * @param y - the Y coordinate to use for ?
 * @param selectionStart - the start position of the view
 * @param selectionEnd - the end position of the view
 */
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

    let resistancesPresent = false;
    for (const orf of region.orfs) {
        if (orf.resistance) {
            resistancesPresent = true;
            break;
        }
    }

    const allOrfs = region.orfs.sort(sort_biosynthetic_orfs_last).map((o) => new Orf(o));
    const allBorders: Area[] = (region.clusters ?? []).map((cluster) => (Area.fromInterface(cluster)));
    const allSites: ISites = region.sites;
    const containsPairedOrfs = pairOrfs(allOrfs);
    const containsPairedBorders = pairBorders(allBorders);
    const containsPairedElements = containsPairedOrfs || containsPairedBorders;

    const axisHeight = 20;
    const minimapHeight = 40;
    const clusterHeight = Math.max.apply(Math, region.clusters.map((border) => border.height)) * 12;
    const undergeneHeight = (resistancesPresent || region.sites.ttaCodons.length > 0) ? Math.floor(height * 2 / 3) : 0;
    let sourceName: string | null = null;
    let multipleSourceNames: boolean = false;
    if (region.sources) {
        for (const source of region.sources) {
            if (!source.name) {
                continue;
            }
            if (!sourceName) {
                sourceName = source.name;
                continue;
            }
            if (sourceName !== source.name) {
                multipleSourceNames = true;
                break;
            }
        }
    }
    const sourceHeight = multipleSourceNames ? 20 : 0;
    const realHeight = height + (2 * LABEL_HEIGHT) + clusterHeight + minimapHeight + axisHeight + undergeneHeight + sourceHeight;
    const regionIndex: number = region.idx;

    const container = d3select(`#${id}`);
    const width = $(`#${id}`).parent().width() || 700;
    container.selectAll("svg").remove();
    container.selectAll("div").remove();
    const modifier = containsPairedElements ? 10 : 0;
    const chart = container.append("svg")
        .attr("height", realHeight)
        .attr("width", "100%")
        .attr("viewbox", `-1 0 ${width} ${realHeight}`);

    if (containsPairedElements) {
        const defs = chart.append("defs");
        const fader = defs.append("linearGradient")
            .attr("id", "cross-origin-region-gradient-fade")
            .attr("x1", "0%")
            .attr("x2", "100%")
            .attr("y1", "0%")
            .attr("y2", "0%");
        fader.append("stop")
            .attr("offset", "0%")
            .style("stop-opacity", 0);
        fader.append("stop")
            .attr("offset", "50%")
            .style("stop-opacity", .75);
        fader.append("stop")
            .attr("offset", "100%")
            .style("stop-opacity", 1);
    }

    const idx = uniqueID++;
    verticalOffset = height / 10;
    scale = d3scaleLinear()
        .domain([selectionStart, selectionEnd])
        .range([2 + modifier, width - 2 - modifier]);  // allow a little padding for any ticks/lines at the edge
    drawOrderedRegionOrfs(chart, allOrfs, allBorders, allSites,
                          idx, realHeight, width, verticalOffset,
                          selectionStart, selectionEnd, height);
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
    if (region.sources) {
        drawSources(chart, region.sources, region, sourceHeight * 0.8, width,
                    realHeight - minimapHeight - axisHeight, selectionStart, selectionEnd);
    } else {
        chart.append<SVGGElement>("g")
            .attr("class", "svgene-axis")
            .attr("transform", `translate(0,${(realHeight - minimapHeight - axisHeight - sourceHeight)})`)
            .call(axis);
    }

    createMinimap(chart, region.start, region.end, realHeight - minimapHeight / 2, minimapHeight, allOrfs, width);
    createHandlers();
}

/**
 * Returns the value, bounded by both minimum and maximum values
 *
 * @param minValue - the lower bound
 * @param value - the value to ensure is within the bounds
 * @param maxValue - the upper bound
 */
function boundedValue(minValue: number, value: number, maxValue: number): number {
    return Math.max(minValue, Math.min(value, maxValue));
}

/**
 * Creates the minimap of a region, shown under the main view, which allows the
 * user to pan and zoom arbitrarily within the region.
 *
 * @param chart - the SVG element
 * @param regionStart - the start of the region, in nucleotides
 * @param regionEnd - the end of the region, in nucleotides
 * @param centerline - the Y coordinate for the midpoint of the minimap's height
 * @param minimapHeight - the height to use for the minimap
 * @param orfs - the ORFs to display in the minimap, this should match those supplied to the main view
 * @param fullWidth - the width of the main view
 */
function createMinimap(chart: any, regionStart: number, regionEnd: number,
                       centerline: number, minimapHeight: number, orfs: Orf[],
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
    const minimapOrfs: d3.Selection<any, Orf, any, any> = chart.selectAll("rect.svgene-minimap-orf")
        .data(orfs)
        .enter()
          .append("rect")
            .attr("width", (d: Orf) => minimapScale(d.end) - minimapScale(d.start))
            .attr("height", orfHeight)
            .attr("x", (d: Orf) => minimapScale(d.start))
            .attr("y", centerline - orfHeight / 2)
            .attr("class", (d: Orf) => `svgene-type-${d.type} ${SELECTED_ORF_CLASS} svgene-minimap-orf`)
            .attr("id", (d: Orf) => `svgene-minimap-orf-${tag_to_id(d.locusTag)}`);

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

/**
 * A comparison function used to determine ordering of ORFs based on their position
 * and function, so that core ORFs are always displayed on top in cases where ORFs overlap.
 * Returns positive integers for cases where the first ORF provided should be drawn before the second,
 * and negative numbers when the second should be drawn before the first.
 *
 * @param a - the first ORF to order
 * @param b - the second ORF to order
 *
 * @returns A positive value if a sorts before b, otherwise a negative value
 */
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

/**
 * Converts a gene's locus tag to the id of the matching ORF element.
 *
 * @param tag - the identifier to convert
 */
export function tag_to_id(tag: string): string {
    return tag.replace(/(:|\.)/g, "-").replace(/-svgeneorf/g, "_orf");
}

/**
 * Toggles the selection state of the given DOM element.
 *
 * @param geneElement - the element representing the ORF
 */
function multi_select(geneElement: JQuery<HTMLElement>): void {
    // use the base HTMLElement here because JQuery falls over with hasClass()
    if (geneElement[0].classList.contains(SELECTED_ORF_CLASS)) {
        deselectOrfs(geneElement);
        // if it was the last one, reselect everything
        if ($(`.${ORF_GROUP_CLASS}.${SELECTED_ORF_CLASS}`).length === 0) {
            selectOrfs();
            removeExternalSelectedIndicators();
        }
    } else {
        // if it's the first, deselect everything else first
        if ($(`.${ORF_GROUP_CLASS}.${SELECTED_ORF_CLASS}`).length === 0) {
            deselectOrfs();
        }
        selectOrfs(geneElement);
    }
    toggleCDSCollapserMatchingElement(geneElement, "cds");
}

/**
 * An event callback function to bind to elements that link to an ORF in the visualisation.
 *
 * @param event - the event that triggered the handler
 */
export function locusSelectionHandler(this: HTMLElement, event: JQuery.Event): void {
    const locus = this.getAttribute("data-locus");
    if (!locus) {
        return;
    }
    selectOrfsByLoci([locus], event.ctrlKey || event.metaKey);
}

/**
 * An event callback function bound to ORF elements to toggle the selection state.
 *
 * @param event - the event that triggered the handler
 */
function tooltip_handler(this: HTMLElement, ev: JQuery.Event): void {
    // if a legend button is active, remove that
    $(".legend-selected").removeClass("legend-selected");

    if (ev.ctrlKey || ev.metaKey) {
        multi_select($(this));
        return;
    }
    cdsSelector($(this));
}

/**
 * An event callback function bound to ORF descriptions, linking to the antiSMASH database.
 * This allows for BLAST functionality on that dataset, submitting the job via
 * via the database's API and then opening a new window/tab to the job results.
 *
 * @param event - the event that triggered the handler
 */
async function asdb(this: HTMLElement, event: JQuery.Event) {
    const submissionUrl = "https://antismash-db.secondarymetabolites.org/api/jobs/clusterblast";
    const resultsUrl = "https://antismash-db.secondarymetabolites.org/job/";  // followed by job ID
    try {
        const response = await fetch(submissionUrl, {
            body: JSON.stringify({
                name: $(this).attr("data-locus"),
                sequence: $(this).attr("data-seq"),
            }),
            headers: {
              "Content-Type": "application/json",
            },
            method: "POST",
            mode: "cors",
        });
        const link = await response.json();
        window.open(resultsUrl + link.id, "_blank");
    } catch (error) {
        alert("The antiSMASH database is not currently accessible: " + error);
    }
}

/**
 * Toggles the ORF selection state, updating any information in other elements connected to the ORF
 *
 * @param element - the ORF element
 * @param skipFocusPanel - whether to skip updates of the associated elements
 */
function cdsSelector(element: JQuery<HTMLElement>, skipFocusPanel: boolean = false): void {
    if (!displayedRegion) {
        return;
    }
    const node: d3.Selection<any, Orf, any, any> = d3selectAll(element.toArray());
    const data: Orf = node.datum();
    if (!skipFocusPanel) {
        const panelContent = $(`.focus-panel-content-${displayedRegion.anchor}`);
        panelContent.html(data.description).find(".collapser").click(toggleCollapserHandler);
        replaceWildcards(panelContent[0], displayedRegion);
        $(".clipboard-copy", panelContent).off("click").click(copyToClipboard);
        $(".asdb-linkout", panelContent).off("click").click(asdb);
    }
    if (node.classed(SELECTED_ORF_CLASS) && $(`.svgene-orf.${SELECTED_ORF_CLASS}`).length === 1) {
        selectOrfs();
    } else {
        deselectOrfs();
        selectOrfs(element);
        if (data.otherSide) {
            selectOrfs($(`#${locusToFullId(data.otherSide.locusTag)}-${ORF_GROUP_CLASS}`));
        }
    }
    toggleCDSCollapserMatchingElement(element, "cds");
}

/**
 * Adds event handlers to all visualisation elements
 */
function createHandlers(): void {
    $(`.${ORF_GROUP_CLASS}`).mouseover(function(e) {
        let id = $(this).attr("id");
        if (typeof id === "undefined") {
            return;
        }
        id = id.replace(`-${ORF_GROUP_CLASS}`, "-label");
        $("#" + id).show();
    }).mouseout(function(e) {
        let id = $(this).attr("id");
        if (typeof id === "undefined") {
            return;
        }
        id = id.replace(`-${ORF_GROUP_CLASS}`, "-label");
        $("#" + id).hide();
    }).click(tooltip_handler);
    $(".svgene-textarea").click((event: JQuery.Event) => event.stopPropagation());
    $(".legend-selector").unbind("click").click(legend_selector);
    $(".zoom-in").unbind("click").click(zoom_to_selection);
    $(".zoom-reset").unbind("click").click(() => resetView());
    if (uniqueID === 1) {
        $(document).keyup(
            (event: JQuery.Event) => {
                const key = event.keyCode;
                if (key === 82) {  // r
                    resetView();
                } else if (key === 90) {  // z
                    zoom_to_selection(event);
                }
            },
        );
    }
}

/**
 * Toggles the visualisation state of all elements related to a candidate cluster
 *
 * @param cluster - the candidate cluster data for which to toggle related elements
 */
function toggleCandidateClusterCollapsers(cluster: Area): void {
    // hide any open candidate cluster expanders
    toggleCollapser($(".collapser-level-candidate.expanded"));
    // then expand relevant expanders
    const target = cluster.product.split(":")[0].split(" ")[1];
    toggleCollapser($(`.collapser-level-candidate.collapser-target-CC${target}`));
}

/**
 * Toggles the visualisation state of all elements related to an ORF
 *
 * @param geneElement - the ORF element for which to toggle related elements
 * @param level - the particular level of related elements to toggle (see antismash.common.html_renderer.collapser_start)
 */
function toggleCDSCollapserMatchingElement(geneElement: JQuery<HTMLElement>, level: string): void {
    const node: d3.Selection<any, Orf, any, any> = d3selectAll(geneElement.toArray());
    const data: Orf = node.datum();
    toggleCollapser($(`.collapser-target-${tag_to_id(data.getLocus())}.collapser-level-${level}`));
}

/**
 * Collapses all collapsers at the CDS level
 */
function hideCDSLevelCollapsers(): void {
    toggleCollapser($(".collapser-level-cds.expanded"));
}

/**
 * Marks all ORF elements within the given range as selected
 *
 * @param start - the start of the range
 * @param end - the end of the range
 */
function select_by_range(start: number, end: number): void {
    $(".legend-selected").removeClass("legend-selected");
    $(`.${ORF_GROUP_CLASS}`).each(function(index) {
        const node: d3.Selection<any, Orf, any, any> = d3selectAll($(this).toArray());
        const data: Orf = node.datum();
        if (start <= data.start && data.end <= end) {
            selectOrfs($(this));
            toggleCDSCollapserMatchingElement($(this), "candidate");
            toggleCDSCollapserMatchingElement($(this), "protocluster");
        }
    });
}

/**
 * Updates the visualisation for the given ORFSs to the given selection state
 *
 * @param orfs - the ORF elements
 * @param selected - the selection state to set the ORFs to
 */
function changeOrfSelectedState(orfs: JQuery<HTMLElement>, selected: boolean) {
    const opacity = selected ? "1" : "0.5";
    // orfs here includes the minimap ORFs, so halve the number
    const allSelected = displayedRegion && orfs.length / 2 === displayedRegion.orfs.length;
    if (allSelected) {
        removeExternalSelectedIndicators();
    }

    const d3orfs: d3.Selection<any, Orf, any, any> = d3selectAll(orfs.toArray());
    // set visibility of orf collection
    d3orfs.classed(SELECTED_ORF_CLASS, selected);
    d3orfs.selectAll(".svgene-orf")
        .classed(SELECTED_ORF_CLASS, selected)
        .attr("opacity", opacity);
    // ensure any attached circular markers have matching opacity and borders
    d3orfs.selectAll(".circular-marker")
        .attr("opacity", opacity);
    d3orfs.selectAll(".circular-border")
        .style("stroke-width", selected ? "1px" : "0")
        .style("stroke", selected ? "black" : "none");
    // and that outlines are enabled/disabled as appropriate
    d3orfs.selectAll(".svgene-orf-border")
        .style("stroke-width", selected ? "1px" : "0")
        .style("stroke", selected ? "black" : "none");
    d3orfs.each((data: Orf) => {
            // update the minimap
            d3selectAll(`#svgene-minimap-orf-${tag_to_id(data.locusTag)}`)
                .attr("opacity", opacity)
                .classed(SELECTED_ORF_CLASS, selected);
            // update domains related to this orf
            const prefix = locusToFullId(data.locusTag);
            if (selected) {  // not a toggle due to default state sync
                $(`#${prefix}-domains`).show();
                $(`.${prefix}-generic-domains`).show();
            } else {
                $(`#${prefix}-domains`).hide();
                $(`.${prefix}-generic-domains`).hide();
            }
            if (!allSelected) {
                changeExternalSelectedIndicator(data.locusTag, selected);
            }
        });
}

/**
 * Updates the selection markers for elements outside the SVG visualistions
 *
 * @param identifier - the identifier of the ORF for which to update connected elements
 * @param show - the selection state to set the connected components to
 * @param fromId - whether to convert the identifier to a locus/tag name
 */
function changeExternalSelectedIndicator(identifier: string, show: boolean, fromId: boolean = false) {
    if (!identifier) {
        return;
    }
    if (fromId) {
        identifier = fullIdToLocus(identifier);
    }
    if (show) {
        $(`.cds-selected-marker-${identifier}`).addClass("active");
    } else {
        $(`.cds-selected-marker-${identifier}`).removeClass("active");
    }
}

/**
 * Removes all active selection markers for elements outside the SVG visualistions
 *
 */
function removeExternalSelectedIndicators() {
    /* hides all selected CDS markers that may exist */
     $(".cds-selected-marker").removeClass("active");
}

/**
 * Marks all the given ORFs as selected, if no ORFs are provided, the selection
 * will default to all ORFs in the visualisation
 *
 * @param orfs - the subset of ORF elements to mark selected, if not all ORFs
 */
function selectOrfs(orfs?: JQuery<HTMLElement>) {
    if (typeof orfs === "undefined") {
        orfs = $(`.${ORF_GROUP_CLASS}, .svgene-minimap-orf`);
    }
    changeOrfSelectedState(orfs, true);
}

/**
 * Marks all the given ORFs as defselected, if no ORFs are provided, the selection
 * will default to all ORFs in the visualisation
 *
 * @param orfs - the subset of ORF elements to mark selected, if not all ORFs
 */
function deselectOrfs(orfs?: JQuery<HTMLElement>) {
    if (typeof orfs === "undefined") {
        orfs = $(`.${ORF_GROUP_CLASS}.${SELECTED_ORF_CLASS}`);
    }
    changeOrfSelectedState(orfs, false);
}

/**
 * An event handler for visualisation legends to (de)select all ORFs with that
 * gene function.
 *
 * @param event - the triggering event
 */
function legend_selector(this: HTMLElement, event: JQuery.Event) {
    const originalID = $(this).attr("data-id");
    if (typeof originalID === "undefined") {
        return;
    }
    let target = ".contains-tta-codon";
    if (originalID === "legend-tta-codon") {
        target = ".contains-tta-codon";
    } else if (originalID === "legend-resistance") {
        target = ".svgene-resistance-orf";
    } else {
        target = `.${originalID.replace("legend-", "svgene-")}`;
    }
    target += "-group";
    if ($(this).hasClass("legend-selected")) {
        $(this).removeClass("legend-selected");
        deselectOrfs($(target));
        if ($(".legend-selected").length === 0) {
            selectOrfs();
        }
        return;
    }
    if (!(event.ctrlKey || event.metaKey) || $(".legend-selected").length === 0) {
        $(".legend-selected").removeClass("legend-selected");
        deselectOrfs();
    }
    $(this).addClass("legend-selected");
    selectOrfs($(target));
}

/**
 * Zooms the viewer to cover the minimal area containing all selected ORFs.
 *
 * @param event - the relevant event, if any
 */
export function zoom_to_selection(event?: JQuery.Event) {
    if (!displayedRegion) {
        return;
    }
    let start = -1;
    let end = -1;
    $(`.${SELECTED_ORF_CLASS}`).each(function(index) {
        const node: d3.Selection<any, Orf, any, any> = d3selectAll($(this).toArray());
        const data: Orf = node.datum();
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
    change_view(Math.max(displayedRegion.start, start - 3000), Math.min(end + 3000, displayedRegion.end));
}

/**
 * Changes the currently visible area of the visualisation to the given range
 *
 * @param start - the start of the range
 * @param end - the end of the range
 * @param changedByMinimap - whether the minimap also needs to have it's shown area updated, defaults to false
 */
function change_view(start: number, end: number, changedByMinimap?: boolean) {
    if (displayedRegion === null) {
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

    const orfs: d3.Selection<any, Orf, any, any> = d3selectAll(".svgene-orf,.svgene-orf-bg");
    orfs.transition().duration(duration)
        .attr("points", (d: Orf) => geneArrowPoints(d));
    const orfBorders: d3.Selection<any, Orf, any, any> = d3selectAll(".svgene-orf-border");
    orfBorders.transition().duration(duration)
        .attr("d", (d: Orf) => geneArrowPoints(d, true));

    const orfLabels: d3.Selection<any, Orf, any, any> = d3selectAll(".svgene-locustag *");
    orfLabels.transition().duration(duration)
        .attr("x", (d: Orf) => d.start < midpoint ? scale(d.start) : scale(d.end))
        .attr("text-anchor", (d: Orf) => d.start < midpoint ? "start" : "end");

    const interactionZones: d3.Selection<any, Area, any, any> = d3selectAll(".cluster-background");
    interactionZones.transition().duration(duration)
        .attr("width", (d: Area) => scale(d.neighbouringEnd) - scale(d.neighbouringStart) - d.getWidthOffset())
        .attr("x", (d: Area) => scale(d.neighbouringStart) + d.getWidthOffset());
    const clusterBoxes: d3.Selection<any, Area, any, any> = d3selectAll(".cluster-core");
    clusterBoxes.transition().duration(duration)
        .attr("width", (d) => scale(d.end) - scale(d.start) - d.getWidthOffset())
        .attr("x", (d) => scale(d.start) + d.getWidthOffset());
    const clusterLines: d3.Selection<any, Area, any, any> = d3selectAll(".cluster-line");
    clusterLines.transition().duration(duration)
        .attr("x1", (d) => scale(d.neighbouringStart) + d.getWidthOffset())
        .attr("x2", (d) => scale(d.neighbouringEnd));
    const leftCircularMarkers: d3.Selection<any, Area | Orf, any, any>  = orfs.selectAll(".left-circular-marker");
    leftCircularMarkers.transition().duration(duration)
        .style("transform", (d: Area | Orf) => new Transform(
            d.transform.scale.x,
            d.transform.scale.y,
            -(d instanceof Area ? scale(d.neighbouringStart) : scale(d.start)) - 13,
            d.transform.translate.y,
        ).toStyle());
    const rightCircularMarkers: d3.Selection<any, Area | Orf, any, any> = orfs.selectAll(".right-circular-marker");
    rightCircularMarkers.transition().duration(duration)
        .style("transform", (d: Area | Orf) => new Transform(
            d.transform.scale.x,
            d.transform.scale.y,
            d instanceof Area ? Math.max(0, scale(d.neighbouringEnd) - scale(end)) - 1 : scale(d.end) - scale(end),
            d.transform.translate.y,
        ).toStyle());
    const clusterLabels: d3.Selection<SVGTextElement, Area, any, any> = d3selectAll(".clusterlabel");
    clusterLabels.transition().duration(duration)
        .attr("x", (d): number => scale((Math.max(d.start, start + 1) + Math.min(d.end, end - 1)) / 2));
    const resistanceMarkers: d3.Selection<SVGElement, Orf, any, any> = d3selectAll(".svgene-resistance");
    // because both the data (because of the legend) and the resistance could be undefined
    resistanceMarkers.filter((d: Orf) => d && d.resistance === true)
        .transition().duration(duration)
        .attr("x", (d: Orf) => scale(d.start))
        .attr("width", (d: Orf) => scale(d.end) - scale(d.start));
    const ttaCodons: d3.Selection<SVGElement, ITTACodon, any, any> = d3selectAll(".svgene-tta-codon");
    ttaCodons.filter((d: ITTACodon) => typeof d !== "undefined")  // avoid the legend which isn't bound
        .transition().duration(duration)
        .attr("points", (d: ITTACodon) => ttaCodonPoints(d, HEIGHT, orfY, verticalOffset));
    let bindingSites: d3.Selection<SVGElement, IBindingSite, any, any> = d3selectAll(".svgene-binding-site");
    bindingSites = bindingSites.filter((d: IBindingSite) => typeof d !== "undefined").each(function(d: IBindingSite) {
        const x = scale(d.loc + d.len / 2);
        d3select(this).selectAll("line")
            .transition().duration(duration)
            .attr("x1", x)
            .attr("x2", x);
        d3select(this).selectAll("circle")
            .transition().duration(duration)
            .attr("cx", x);
    });

    const sourceMarkers: d3.Selection<SVGElement, ISource, any, any> = d3selectAll(".svgene-source-marker");
    sourceMarkers.transition().duration(duration).attr("x", (d: ISource) => scale(d.recordEnd));
    if (sourceInfo.length < 2) {
        if (axis !== null) {
            d3select<any, any>(".svgene-axis")
                .transition().duration(duration)
                .call(axis);
        }
    } else {
        // update the range the subaxes cover
        for (const info of sourceInfo) {
            info.scale.range([scale(info.sourceData.recordStart), scale(info.sourceData.recordEnd)]);
        }
        // then transition them into their new positions
        const subaxes: d3.Selection<any, any, any, any> = d3selectAll(".svgene-subaxis").each(function(d: any) {
            d3select(this).transition().duration(duration).call(d.axis);
        });
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

/**
 * Resets the entire visualistion to the default state
 */
export function resetView() {
    if (displayedRegion === null) {
        return;
    }
    $(".legend-selected").removeClass("legend-selected");
    selectOrfs();
    change_view(displayedRegion.start, displayedRegion.end);
    hideCDSLevelCollapsers();
}

/**
 * Resets the pan/zoom level without changing any other state
 */
export function resetZoom() {
    if (displayedRegion === null) {
        return;
    }
    change_view(displayedRegion.start, displayedRegion.end);
}

let axis: d3.Axis<any> | null = null;
const sourceInfo: SourceInfo[] = [];
let minimapScale: d3.ScaleLinear<number, number> = d3scaleLinear().domain([0, 100]).range([0, 100]);
let verticalOffset: number = 0;
let orfY: number = 0;
let displayedRegion: IRegion | null = null;
let scale: d3.ScaleLinear<number, number> = d3scaleLinear().domain([0, 100]).range([0, 100]);
let uniqueID: number = 0;
