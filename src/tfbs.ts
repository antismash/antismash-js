/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

import {select as d3select} from "d3-selection";
import {IOrf, IRegion} from "./dataStructures.js";
import {selectOrfsByLoci, tag_to_id} from "./viewer.js";

interface IGene {
    readonly name: string;
    readonly strand: number;
    readonly location: number;
    readonly length?: number; // only present for fully contained genes
}

interface IHit {
    readonly name: string;
    readonly start: number;
    readonly end: number;
    readonly strand: number;
    readonly confidence: string;
    readonly presequence: string;
    readonly sequence: string;
    readonly postsequence: string;
    readonly target: string;
    readonly contained_by_left: boolean;
    readonly matches: boolean[];
    readonly left?: IGene;
    readonly mid?: IGene;
    readonly right?: IGene;
}

const seqWidth = 300;
const nearbyCharSize = 9;
const nearbyPadding = nearbyCharSize / 2;
const boundaryPadding = nearbyPadding / 2;

const topRowY = 40;
const midRowY = topRowY + 18;
const bottomRowY = midRowY + 16;

const geneTop = topRowY - 15;
const geneBottom = topRowY + 5;
const genePoint = (geneTop + geneBottom) / 2;
const geneDX = 40;
const geneCharSize = 12;
const minGeneWidth = 100;

/**
 * Adds SVG elements to the parent element to show arrows
 *
 * All replacement targets must use the {@link WILDCARD_PATTERN | expected pattern}
 * to mark substitution targets, and all targets must be contained by the data object.
 *
 * @param parent - the parent group element
 * @param start - the start coordinate of the arrow
 * @param end - the end coordinate of the arrow
 * @param y - the Y coordinate for the arrow line
 * @param arrowSize - the height of the arrow head from center line to top/bottom
 */
function buildArrow(parent: any, start: number, end: number, y: number, arrowSize: number) {
    const arrowHalf = arrowSize / 2;
    parent.append("line")
        .attr("x1", start)
        .attr("x2", end)
        .attr("y1", y)
        .attr("y2", y)
        .attr("class", "tfbs-arrow-base");
    if (start > end) {
        arrowSize *= -1;
    }
    parent.append("path")
        .attr("d", `M ${end} ${y} L ${end - arrowSize} ${y + arrowHalf} L ${end - arrowSize} ${y - arrowHalf} z`)
        .attr("class", "tfbs-arrow-head");
}

/**
 * Fills in all container elements in a region with their matching SVG
 *
 * @param anchor - the anchor string of the element
 * @param results - the results as provided by antiSMASH's generate_javascript_data for the module
 */
export function drawBindingSites(anchor: string, results: IHit[]) {
    if (!results) {
        return;
    }
    // first find the max name lengths to know how long to make gene arrows
    // separated into weak and other, since weak is hidden away
    let maxDecentNameLengthLeft = 0;
    let maxDecentNameLengthRight = 0;
    let maxWeakNameLengthLeft = 0;
    let maxWeakNameLengthRight = 0;
    for (const hit of results) {
        if (hit.confidence !== "weak") {
            if (hit.left && hit.left.name.length > maxDecentNameLengthLeft) {
                maxDecentNameLengthLeft = hit.left.name.length;
            }
            if (hit.right && hit.right.name.length > maxDecentNameLengthRight) {
                maxDecentNameLengthRight = hit.right.name.length;
            }
        } else {
            if (hit.left && hit.left.name.length > maxWeakNameLengthLeft) {
                maxWeakNameLengthLeft = hit.left.name.length;
            }
            if (hit.right && hit.right.name.length > maxWeakNameLengthRight) {
                maxWeakNameLengthRight = hit.right.name.length;
            }
        }
    }
    const geneWidth = Math.max(minGeneWidth, geneCharSize * Math.max(maxDecentNameLengthLeft,
                                                                     maxDecentNameLengthRight));
    const seqStart = geneWidth + geneDX + (results[0].presequence.length + 2) * nearbyCharSize;
    const seqEnd = seqStart + seqWidth;
    for (const hit of results) {
        const id = `tfbs-${anchor}-${hit.start}-${hit.name}`;
        const container = $(`#${id}`);
        // don't draw if they already exist
        if ($(container).children().length > 0) {
            continue;
        }

        const charSize = seqWidth / hit.sequence.length;
        const preSize = nearbyCharSize * hit.presequence.length + nearbyPadding;
        const postSize = nearbyCharSize * hit.postsequence.length + nearbyPadding;
        const contextStart = seqStart - preSize - nearbyPadding;
        const contextEnd = seqEnd + postSize + nearbyPadding;

        const svg = d3select(`#${id}`).append("svg")
          .attr("width", contextEnd + geneDX + geneWidth)
          .attr("height", bottomRowY + 25)
          .attr("id", id)
          .attr("class", "tfbs-svg");

        // genome's sequence
        svg.append("text")
            .attr("x", contextStart)
            .attr("y", topRowY)
            .attr("textLength", preSize)
            .attr("class", "tfbs-sequence tfbs-hit-text-nearby")
            .text(hit.presequence);
        const seq = svg.append("g");
        svg.append("text")
            .attr("x", seqEnd + nearbyPadding)
            .attr("y", topRowY)
            .attr("textLength", preSize)
            .attr("class", "tfbs-sequence tfbs-hit-text-nearby")
            .text(hit.postsequence);

        // the match line
        const matchLine = svg.append("g");
        // target/reference sequence
        const consensus = svg.append("g");

        for (let i = 0; i < hit.target.length; i++) {
            const x = seqStart + i * charSize + charSize / 4;
            seq.append("text")
                .attr("x", x)
                .attr("y", topRowY)
                .attr("class", "tfbs-sequence")
                .text(hit.sequence[i]);
            matchLine.append("text")
                .attr("x", x)
                .attr("y", midRowY)
                .attr("class", "tfbs-sequence tfbs-hit-text-nearby")
                .text(hit.matches[i] ? "|" : "\u00A0");
            consensus.append("text")
                .attr("x", x)
                .attr("y", bottomRowY)
                .attr("class", `tfbs-sequence ${hit.target[i] === "N" ? "tfbs-hit-text-nearby" : ""}`)
                .text(hit.target[i]);
        }

        // coordinates of hit and hit boundaries
        const boundary = svg.append("g").attr("class", "tfbs-boundary");
        boundary.append("text")
            .text(hit.start.toLocaleString())
            .attr("text-anchor", "middle")
            .attr("x", seqStart - boundaryPadding)
            .attr("y", topRowY - 20)
            .attr("class", "tfbs-coordinate");
        boundary.append("line")
            .attr("x1", seqStart - boundaryPadding)
            .attr("x2", seqStart - boundaryPadding)
            .attr("y1", topRowY - 15)
            .attr("y2", bottomRowY + 5)
            .attr("class", "tfbs-line");

        boundary.append("text")
            .text(hit.end.toLocaleString())
            .attr("text-anchor", "middle")
            .attr("x", seqEnd + boundaryPadding)
            .attr("y", topRowY - 20)
            .attr("class", "tfbs-coordinate");
        boundary.append("line")
            .attr("x1", seqEnd + boundaryPadding)
            .attr("x2", seqEnd + boundaryPadding)
            .attr("y1", topRowY - 15)
            .attr("y2", bottomRowY + 5)
            .attr("class", "tfbs-line");

        // draws the context spacer between sequence information and gene arrows
        const drawSpacer = (x: number, direction: number, value: number = 0) => {
            const spacer = svg.append("g")
                .attr("class", "tfbs-nearby");
            for (let i = 0; i < 3; i++) {
                spacer.append("circle")
                    .attr("cx", x + (5 + i * 10) * direction)
                    .attr("cy", topRowY - 6)
                    .attr("r", 2)
                    .attr("class", "tfbs-ellipsis");
            }
            if (value <= 0) {
                return;
            }
            for (let i = -1; i < 2; i += 2) {
                buildArrow(spacer, x + 15 * direction, x + 15 * direction + 30 * i, bottomRowY, 8);
            }
            spacer.append("text")
                .text(value.toLocaleString())
                .attr("x", x + 15 * direction)
                .attr("y", (midRowY + bottomRowY) / 2)
                .attr("text-anchor", "middle")
                .attr("class", "tfbs-hit-text-nearby");
        };

        // draws the gene name and indicator for strand and position
        const drawGene = (geneContainer: any, gene: IGene, x: number, geneStart: boolean,
                          width: number, textAnchor: string, textStart: number) => {
            let tipSize = geneWidth * 0.05;
            if (width < 0) {
                tipSize *= -1;
            }
            let path = "";
            if (geneStart) {
                path = `M ${x},${geneBottom}
                        L ${x + width},${geneBottom}
                        L ${x + width},${geneTop}
                        L ${x},${geneTop}`;
            } else {
                path = `M ${x},${geneBottom}
                        L ${x + width - tipSize},${geneBottom}
                        L ${x + width},${genePoint}
                        L ${x + width - tipSize},${geneTop}
                        L ${x},${geneTop}`;
            }
            const group = geneContainer.append("g")
                .attr("class", "tfbs-gene");

            group.append("text")
                .attr("x", textStart)
                .attr("y", topRowY)
                .text(gene.name)
                .attr("text-anchor", textAnchor)
                .attr("class", "serif tfbs-gene-label")
                .attr("data-locus", gene.name);
            group.append("path")
                .attr("class", "tfbs-line")
                .attr("d", path)
                .attr("fill", "none");
        };

        if (hit.left && hit.contained_by_left && hit.right) {
            // invert
            drawGene(svg, hit.left, contextStart - geneDX, hit.left.strand === 1,
                     -geneWidth, "start", contextStart - geneDX - geneWidth * .9);
            drawSpacer(contextStart, -1, hit.start - hit.left.location);
            drawGene(svg, hit.right, contextEnd + geneDX, hit.left.strand === -1,
                     geneWidth, "end", contextEnd + geneDX + geneWidth * .9);
            drawSpacer(contextEnd, 1, hit.right.location - hit.start + hit.sequence.length);
        } else {
            if (hit.left) {
                const distance = hit.start - hit.left.location;
                const x = contextStart - geneWidth - geneDX;
                let width = geneWidth;
                if (distance <= 0) {
                    const insetPosition = seqStart - (distance + 0.2) * charSize;
                    width = insetPosition - x;
                }
                drawGene(svg, hit.left, x, hit.left.strand === -1, width, "end",
                         contextStart - geneDX - geneWidth * .1);
                drawSpacer(contextStart, -1, distance);
            }
            if (hit.mid) {
                // don't use the same gene drawing function as the others,
                // since they're completely different location, etc
                const midStart = seqStart + (hit.mid.location - hit.start) * charSize;
                const midEnd = midStart + (hit.mid.length || 0) * charSize;
                const tipSize = (midEnd - midStart) * 0.05;
                let path = "";
                if (hit.mid.strand !== -1) {
                    // gene pointing to the right, anticlockwise from bottom left
                    path = `M ${midStart},${geneBottom}
                            L ${midEnd - tipSize},${geneBottom}
                            L ${midEnd},${genePoint}
                            L ${midEnd - tipSize},${geneTop}
                            L ${midStart},${geneTop}
                            Z`;  // close the path, unlike the other genes
                } else {
                    // gene pointing to the left, clockwise from bottom right
                    path = `M ${midEnd},${geneBottom}
                            L ${midStart + tipSize},${geneBottom}
                            L ${midStart},${genePoint}
                            L ${midStart + tipSize},${geneTop}
                            L ${midEnd},${geneTop}
                            Z`;  // again, close the path, unlike the other genes
                }
                const group = svg.append("g")
                    .attr("class", "tfbs-gene");

                group.append("path")
                    .attr("class", "tfbs-line")
                    .attr("d", path)
                    .attr("fill", "none");
                // and don't add the name, since it would overlap with the sequence
            }
            if (hit.right) {
                const x = contextEnd + geneWidth + geneDX;
                let width = -geneWidth;
                if (hit.right.location < hit.end) {
                    const insetPosition = seqEnd + (hit.right.location - hit.end) * charSize;
                    width = insetPosition - x;
                }
                drawGene(svg, hit.right, x, hit.right.strand === 1, width, "start",
                         contextEnd + geneDX + geneWidth * .1);
                drawSpacer(contextEnd, 1, hit.right.location - hit.end);
            }
        }
        // consensus strand indicator
        const thirds = (contextEnd - contextStart) / 3;
        const start = contextStart + thirds;
        const end = contextEnd - thirds;
        const strandIndicator = svg.append("g")
            .attr("class", "tfbs-line tfbs-strand");
        if (hit.strand !== -1) {
            buildArrow(strandIndicator, start, end, bottomRowY + 15, 10);
        } else {
            buildArrow(strandIndicator, end, start, bottomRowY + 15, 10);
        }
    }
    $(".tfbs-gene-label").off("click").on("click", function(this: HTMLElement) {
        const locus = this.getAttribute("data-locus");
        if (locus) {
            selectOrfsByLoci([locus]);
        }
    });
}
