const DATA_URL = "data/adventures.json";

let adventureData = null;

function normalize(value) {
  if (!value) return "";

  return String(value)
    .toLocaleLowerCase()
    .replaceAll("’", "'")
    .replace(/[^\p{L}\p{N}_]+/gu, " ")
    .trim();
}

function containsTerm(text, term) {
  const haystack = ` ${normalize(text)} `;
  const needle = ` ${normalize(term)} `;

  return haystack.includes(needle);
}

function activityText(activity) {
  const parts = [];

  for (const field of ["title", "setting", "description"]) {
    if (activity[field]) {
      parts.push(String(activity[field]));
    }
  }

  for (const item of activity.supply_list || []) {
    if (item) {
      parts.push(String(item));
    }
  }

  for (const section of activity.sections || []) {
    if (section.heading) {
      parts.push(String(section.heading));
    }

    if (section.content) {
      parts.push(String(section.content));
    }
  }

  return parts.join("\n");
}

function search(term, rankSlug) {
  const query = normalize(term);

  if (!query) {
    return [];
  }

  const results = [];

  for (const rankData of adventureData.ranks || []) {
    if (rankSlug !== "all" && rankData.slug !== rankSlug) {
      continue;
    }

    for (const adventure of rankData.adventures || []) {
      const requirements = [];

      for (const requirement of adventure.requirements || []) {
        const requirementMatches =
          containsTerm(requirement.text, query);

        const matchingActivities = [];

        for (let i = 0; i < (requirement.activities || []).length; i++) {
          const activity = requirement.activities[i];

          if (containsTerm(activityText(activity), query)) {
            matchingActivities.push({
              number: i + 1,
              title: activity.title
            });
          }
        }

        if (requirementMatches || matchingActivities.length > 0) {
          requirements.push({
            number: requirement.number,
            text: requirement.text,
            requirementMatches,
            activities: matchingActivities
          });
        }
      }

      if (requirements.length > 0) {
        results.push({
          rank: rankData.rank,
          rankSlug: rankData.slug,
          adventure,
          requirements
        });
      }
    }
  }

  return results;
}

function renderResults(results, term) {
  const resultsElement = document.querySelector("#results");

  if (results.length === 0) {
    resultsElement.innerHTML = `
      <div class="empty">
        No Adventures matched <strong>${escapeHtml(term)}</strong>.
      </div>
    `;

    return;
  }

  const grouped = new Map();

  for (const result of results) {
    if (!grouped.has(result.rank)) {
      grouped.set(result.rank, []);
    }

    grouped.get(result.rank).push(result);
  }

  resultsElement.innerHTML = [...grouped.entries()]
    .map(([rank, rankResults]) => `
      <section class="rank-section">
        <h2>
          <span class="rank-emoji" aria-hidden="true">${rankEmoji(rank)}</span>
          ${escapeHtml(rank)}
          <span class="rank-count">
            ${rankResults.length}
            Adventure${rankResults.length === 1 ? "" : "s"} match
          </span>
        </h2>

        <div class="adventure-list">
          ${rankResults.map(renderAdventure).join("")}
        </div>
      </section>
    `)
    .join("");
}

function renderAdventure(result) {
  const adventure = result.adventure;

  const type = adventure.type
    ? capitalize(adventure.type)
    : "";

  const requirements = result.requirements
    .map(renderRequirement)
    .join("");

  return `
    <article class="adventure-card">
      <h3>${escapeHtml(adventure.title)}</h3>

      ${
        type
          ? `<p class="adventure-meta">${escapeHtml(type)}</p>`
          : ""
      }

      <a
        class="adventure-link"
        href="${escapeAttribute(adventure.url)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        View Adventure →
      </a>

      <div class="matching-requirements">
        ${requirements}
      </div>
    </article>
  `;
}

function renderRequirement(requirement) {
  const activities = requirement.activities
    .map(activity => `
      <div class="matching-activity">
        <span class="activity-label">
          Activity ${activity.number}
        </span>
        <span class="activity-title">
          ${escapeHtml(activity.title)}
        </span>
      </div>
    `)
    .join("");

  return `
    <div class="matching-requirement">
      <div class="requirement-title">
        <strong>Requirement ${requirement.number}</strong>
        <span>—</span>
        <span>${escapeHtml(requirement.text)}</span>
      </div>

      ${
        activities
          ? `<div class="matching-activities">${activities}</div>`
          : ""
      }
    </div>
  `;
}

function updateStatus(term, results) {
  const status = document.querySelector("#status");

  const count = results.length;

  status.textContent =
    `Found ${count} Adventure${count === 1 ? "" : "s"} matching “${term}”.`;
}

function rankEmoji(rank) {
  const emojis = {
    "Lion": "🦁",
    "Tiger": "🐯",
    "Wolf": "🐺",
    "Bear": "🐻",
    "Webelos": "⚜️",
    "Arrow of Light": "🏹"
  };

  return emojis[rank] || "";
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

async function loadData() {
  const response = await fetch(DATA_URL);

  if (!response.ok) {
    throw new Error(
      `Could not load adventure data (${response.status}).`
    );
  }

  return response.json();
}

async function initialize() {
  const status = document.querySelector("#status");
  const form = document.querySelector("#search-form");

  try {
    adventureData = await loadData();

    status.textContent =
      "Adventure data loaded. Enter a keyword to search.";
  } catch (error) {
    console.error(error);

    status.innerHTML =
      `<span class="error">Could not load Adventure data.</span>`;

    return;
  }

  form.addEventListener("submit", event => {
    event.preventDefault();

    const term =
      document.querySelector("#search-term").value.trim();

    const rank =
      document.querySelector("input[name=rank]:checked").value;

    if (!term) {
      status.textContent = "Enter a keyword to search.";
      document.querySelector("#results").innerHTML = "";
      return;
    }

    const results = search(term, rank);

    updateStatus(term, results);
    renderResults(results, term);
  });
}

document.addEventListener("DOMContentLoaded", initialize);