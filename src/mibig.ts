/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

interface IContributor {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly organisation: string;
}

const contributorLookupUrl = "/api/v1/contributors?ids[]=";
const revealedIcon = '<svg class="icon"><use xlink:href="images/icons.svg#user"></use></svg>';

function reveal_contributors() {
    const ids: string[] = [];
    const elements = $("li.contributor");
    elements.each(function(this: HTMLElement) {
        const id = $(this).attr("id");
        if (id) {
            ids.push(id);
        }
    });
    fetch(contributorLookupUrl + ids.join("&ids[]="))
        .then((res) => res.json())
        .then((contributors: IContributor[]) => {
            elements.each(function(this: HTMLElement) {
                const id = $(this).attr("id");
                for (const contrib of contributors) {
                    if (contrib.id !== id) {
                        continue;
                    }
                    const detail = `${revealedIcon}<a href="mailto:${contrib.email}">${contrib.name}</a> (${contrib.organisation})`;
                    $(this).html(detail);
                }
            });
        }).catch((error) => null);
}

export function startMibig() {
    reveal_contributors();
}
