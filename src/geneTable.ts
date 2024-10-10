/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

import {IOrf, IRegion} from "./classes/pythonStructures.js";
import {copyToClipboard} from "./clipboard.js";
import {clearSelectedOrfs, locusSelectionHandler, resetZoom, selectOrfsByLoci, zoom_to_selection} from "./viewer.js";
import {replaceWildcards, replaceWildcardsInText} from "./wildcards.js";

interface IMatchReasons {
    columns: string[];
    functions: string[];
}

const CLASS_PREFIX = "gt";

/**
 * Finds and shows all rows in the table that match the given query
 *
 * @param query - the query string as regex
 * @param table - the table in which to search in and modify visibility of rows
 * @param extraData - additional data for each row in the table, keyed by locus tag
 * @returns A boolean indiciting if any matching were found.
 */
function searchTable(query: RegExp, table: HTMLTableElement, extraData: any): boolean {
    let rowCounter = 0;
    const loci: string[] = [];
    let anyHits = false;
    for (const row of table.getElementsByTagName("tbody")[0].querySelectorAll("tr")) {
        const locus = row.getAttribute("data-locus");
        // the locus/name is critical, if it's missing just hide it and skip it
        if (!locus) {
            row.style.display = "none";
            continue;
        }
        const matchReasons: IMatchReasons = {
            columns: [],
            functions: [],
        };
        // do any of the search cells contain a match?
        for (const cell of row.querySelectorAll("td.search-cell") as NodeListOf<HTMLTableDataCellElement>) {
            if (!query.test(cell.innerText)) {
                continue;
            }
            const type = cell.getAttribute("data-type");
            if (!type) {
                continue;
            }
            cell.classList.add(`${CLASS_PREFIX}-matching-cell`);
            matchReasons.columns.push(type);
        }
        // does any of the metadata contain a match?
        let data = extraData[locus];
        if (data === undefined) {
            data = { functions: [] };
        }
        for (const geneFunction of data.functions) {
            let match: string = "";
            if (query.test(geneFunction.name)) {
                match = `${geneFunction.tool}: ${geneFunction.product}`;
            }
            if (query.test(geneFunction.function)) {
                match = `${geneFunction.tool}: ${geneFunction.function}`;
            }
            if (query.test(geneFunction.description)) {
                match = `${geneFunction.tool}: ${geneFunction.description}`;
            }
            if (!match || matchReasons.functions.indexOf(match) !== -1) {
                continue;
            }
            matchReasons.functions.push(match);
        }
        // skip display info if there weren't any hits
        if (matchReasons.columns.length === 0 && matchReasons.functions.length === 0) {
            row.style.display = "none";
            continue;
        }
        // set up the row/results now that there has to be a hit
        anyHits = true;
        loci.push(locus);
        const hitChunks = [];
        if (matchReasons.columns.length > 0) {
            hitChunks.push("Indicated columns<br>");
        }
        if (matchReasons.functions.length > 0) {
            hitChunks.push(`Gene functions:<ul><li>${matchReasons.functions.join("</li><li>")}</li></ul>`);
        }
        showRow(row, ++rowCounter, hitChunks.join(""));
    }

    if (loci.length > 0) {
        clearSelectedOrfs();
        selectOrfsByLoci(loci);
    } else {
        clearSelectedOrfs();
    }
    return loci.length > 0;
}

/**
 * Shows a particular row from the table, including adding in the description of
 * why the particular row is shown.
 *
 * @param row - the particular row to show
 * @param index - the index of the row for the purposes of visual striping (shown rows only)
 * @param matchText - the text to include for matches
 */
function showRow(row: HTMLElement, index: number, matchText: string) {
    if (!matchText) {
        for (const cell of row.querySelectorAll(`.${CLASS_PREFIX}-matching-cell`)) {
            cell.classList.remove(`.${CLASS_PREFIX}-matching-cell`);
        }
    }
    if (index % 2 === 1) {
        row.classList.remove("row-even");
        row.classList.add("row-odd");
    } else {
        row.classList.remove("row-odd");
        row.classList.add("row-even");
    }
    // all striped rows are visible, otherwise things get messy
    row.style.display = "";
    const matchInfoCell = row.querySelectorAll(`td.${CLASS_PREFIX}-cell-match`)[0] as HTMLTableDataCellElement;
    if (!matchInfoCell) {
        return;
    }

    if (matchText.length > 0) {
        matchInfoCell.style.display = matchText.length > 0 ? "" : "none";
        matchInfoCell.innerHTML = matchText;
    }
}

/**
 * Sets up event handlers for the table zoom toggle(s) to ensure they stay
 * synced and update the view as necessary.
 *
 * @param localToggle - the currently displayed region's toggle element
 * @param allToggles - all regions toggle elements
 */
function setupZoomHandler(localToggle: JQuery<HTMLElement>, allToggles: JQuery<HTMLElement>) {
    // remove event handlers for all toggles
    allToggles.off("change");
    // then (re-)enable the handler for the local toggle
    localToggle.on("change", () => {
        const zoomEnabled = localToggle.prop("checked");
        // apply the change to all other regions
        allToggles.not(localToggle).prop("checked", zoomEnabled);

        // then adjust zoom as appropriate
        if (zoomEnabled) {
            zoom_to_selection();
        } else {
            resetZoom();
        }
    });
}

/**
 * Fills the given table with a row for each ORF in the region.
 *
 * @param tableSelector - the selector to use for getting the entire table from the DOM
 * @param region - the region's data object
 * @param data - the gene table JSON object generated by antiSMASH for this region
 */
function fillTable(tableSelector: string, region: IRegion, data: any) {
    const body = $(`${tableSelector} tbody`);
    // if it's already got children, stop
    if ($(body).children().length > 0) {
        return;
    }
    let rowNumber = 1;
    for (const orf of region.orfs.sort((a, b) => a.start - b.start)) {
        const blastLink = replaceWildcardsInText(data.blast_template, orf);
        const selectedMarker = replaceWildcardsInText(data.selected_template, orf);
        const cells = [
            `<td class="serif search-cell" data-type="name">${selectedMarker}${orf.locus_tag}</td>`,
            `<td class="search-cell" data-type="product">${orf.product}</td>`,
            `<td class="gt-cell-numeric">${orf.dna.length}</td>`,
            `<td class="gt-cell-numeric">${orf.translation.length}</td>`,
            `<td class="search-cell" data-type="function"><span class="colour-square legend-type-${orf.type}"></span>${orf.type}</td>`,
            `<td class="seq-copy seq-copy-nt gt-cell-interactable" data-locus="${orf.locus_tag}"><span class="button-like">Copy</span></td>`,
            `<td class="seq-copy seq-copy-aa gt-cell-interactable" data-locus="${orf.locus_tag}"><span class="button-like">Copy</span></td>`,
            `<td class="gt-cell-link gt-cell-interactable">${blastLink}</td>`,
            `<td class="gt-column-match gt-cell-match" style="display:none"></td>`,
        ];

        body.append(`<tr class="gt-row row-${rowNumber % 2 ? "odd" : "even"}" data-locus="${orf.locus_tag}">${cells.join("")}</tr>`);
        rowNumber++;
    }
}

/**
 * Sets up all relevant handlers and state for a gene table. This is expected to
 * be called on region change.
 *
 * @param region - the generic data for the region
 * @param data - the gene table JSON object generated by antiSMASH for this region
 */
export function initGeneTableHandler(region: IRegion, data: any): void {
    const containerID = `#${CLASS_PREFIX}-container-${region.anchor}`;
    const tableID = `#${CLASS_PREFIX}-${region.anchor}`;
    const container: JQuery<HTMLElement> = $(containerID);
    const scrollContainer = container.find(`.${CLASS_PREFIX}-scroll-container`);
    const table: JQuery<HTMLTableElement> = $(tableID);
    const tableHeader: JQuery<HTMLTableElement> = table.find("thead");
    const noHitsLine = container.find(`.${CLASS_PREFIX}-no-hits`);

    const zoomToggle: JQuery<HTMLElement> = $(`#${CLASS_PREFIX}-${region.anchor}-toggle`);

    setupZoomHandler(zoomToggle, $(`.${CLASS_PREFIX}-zoom-toggle`));

    if (table.length === 0) {
        return;
    }

    fillTable(tableID, region, data);

    // handlers for when the CDS selected markers are in use
    let watchMutations = true;
    const mutationObserver = new MutationObserver((mutations, observer) => {
        if (!watchMutations || scrollContainer.length === 0) {
            return;
        }
        const row = $(table.find(".cds-selected-marker.active").first().closest("tr"));
        if (!row.length) {
            return;
        }
        // before getting the positions of a row, reset the position to the top to make the calculations easier
        scrollContainer.scrollTop(0);
        // then get the absolute positions within the container
        const rowPosition = row.position();
        const headerPosition = tableHeader.position();
        const headerHeight = tableHeader.height();
        // if everything exists, then scroll to the position that shows the selected row
        // at the top of the table, or as high as it can be for those rows at the bottom
        if (rowPosition && headerPosition && headerHeight) {
            // animate the scroll slightly to make it more obvious
            scrollContainer.animate({scrollTop: rowPosition.top - headerPosition.top - headerHeight}, "250");
        }
    });
    table.find(".cds-selected-marker").each(function() {
        mutationObserver.observe(this, {
            attributeFilter: ["class"],
            attributes: true,
        });
    });

    // search/filter handler
    const search = $(`${tableID}-search`);
    // handler for every time whenever user updates the text
    search.off(`input.${CLASS_PREFIX}-search`).on("input", function(this: HTMLElement, event: JQuery.Event) {
        event.stopPropagation();  // don't let hotkeys like 'reset' wreck the results
        if (!(this instanceof HTMLInputElement)) {
            return;
        }
        const searchString = this.value;
        $(`.${CLASS_PREFIX}-matching-cell`).removeClass(`${CLASS_PREFIX}-matching-cell`);
        const matchColumn = table.find(`.${CLASS_PREFIX}-column-match`);
        // no query? show all the rows
        if (searchString.length === 0) {
            let index = 1;
            // remove any match markers
            // then show everything
            table.show();
            table.find(`.${CLASS_PREFIX}-row`).each(function(this: HTMLElement) {
                showRow(this, index++, "");
            });
            // but hide the match column
            table.find(`.${CLASS_PREFIX}-column-match`).hide();
            // and ensure the "no hits" row isn't visible
            noHitsLine.hide();
            if (zoomToggle.prop("checked")) {
                resetZoom();
            }
        } else {
            if (!searchTable(new RegExp(searchString, "i"), table[0], data.orfs)) {
                matchColumn.hide();
                table.hide();
                noHitsLine.show();
            } else {
                matchColumn.show();
                table.show();
                noHitsLine.hide();
            }
            if (zoomToggle.prop("checked")) {
                zoom_to_selection();
            }
        }
    })
    // also prevent hotkeys triggering via keyup events while typing in the search field
    .off("keyup").on("keyup", (event: JQuery.Event) => event.stopPropagation());

    // ensure current state is respected on soft refresh
    if (search[0] instanceof HTMLInputElement && search[0].value.length > 0) {
        search.trigger("input");
    }

    // row click handler to highlight genes
    $(`${tableID} tbody tr`).off("click").on("click", function(this: HTMLElement, event: JQuery.Event) {
        // if the particular cell is, itself, iteractable, don't also use it as a selector
        const clicked = $(event.target).closest("td");
        if (clicked.hasClass(`${CLASS_PREFIX}-cell-interactable`)) {
            return;
        }
        // disable the mutation observer, since moving the thing someone is clicking on is awful
        watchMutations = false;
        // do the changes which would trigger the observer
        locusSelectionHandler.call(this, event);
        if (zoomToggle.prop("checked")) {
            zoom_to_selection();
        }
        // then turn the observer back on, but only after it's had a chance to trigger
        setTimeout(() => {
            watchMutations = true;
        }, 50);
    });

    // sequence clipboard copy handlers
    const copiers = $(tableID).find(".seq-copy");
    // set the relevant sequence data
    copiers.each(function(this: HTMLElement) {
        const locus = this.getAttribute("data-locus");
        if (locus === undefined) {
            return;
        }
        const orf = region.orfs.filter((orfData) => orfData.locus_tag === locus)[0];
        if (this.classList.contains("seq-copy-aa")) {
            this.setAttribute("data-seq", orf.translation);
        } else if (this.classList.contains("seq-copy-nt")) {
            this.setAttribute("data-seq", orf.dna);
        }
    });
    // set the handler now that the data is present
    copiers.on("click", copyToClipboard);

    // update anything using ORF data wildcards
    replaceWildcards(table[0], region);
}
