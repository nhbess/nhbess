/**
 * To add a new project, append an object to the PROJECTS array below.
 *
 * Fields:
 *   title       {string}   required
 *   description {string}   required
 *   tags        {string[]} optional  — shown as small badges
 *   thumbnail   {string}   optional  — path to a preview image
 *   link        {string}   optional  — href for an internal project page
 *   paper       {string}   optional  — href for an external paper / URL
 */
const PROJECTS = [
  {
    title: "3-Attractor Dynamical Simulator",
    description:
      "A dynamical system with three musical attractors. The state follows a gradient field; drag the canvas to bend it toward your intention. Sound is synthesised in real-time from the system's position in harmonic/rhythmic space.",
    tags: ["Dynamical Systems", "Web Audio", "Interactive"],
    thumbnail: "assets/images_projects/continuous_sound_generation.png",
    link: "projects/continuous_sound_generation.html",
  },
];

// ─── renderer ────────────────────────────────────────────────────────────────

function renderProjects() {
  const container = document.getElementById("projects-container");
  if (!container) return;

  if (PROJECTS.length === 0) {
    container.innerHTML = '<p class="section-text">Work in progress… 👷</p>';
    return;
  }

  container.innerHTML = "";

  PROJECTS.forEach((project) => {
    const card = document.createElement("article");
    card.className = "project-card";

    const thumbnailHTML = project.thumbnail
      ? `<div class="project-card-thumb">
           <img src="${project.thumbnail}" alt="${project.title}" loading="lazy" />
         </div>`
      : `<div class="project-card-thumb project-card-thumb--placeholder">
           <span>${project.title.charAt(0)}</span>
         </div>`;

    const tagsHTML = project.tags?.length
      ? `<div class="project-card-tags">${project.tags
          .map((t) => `<span class="project-tag">${t}</span>`)
          .join("")}</div>`
      : "";

    const linksHTML = [
      project.link
        ? `<a href="${project.link}" class="project-card-btn" target="_blank">Open <i class="fas fa-arrow-right"></i></a>`
        : "",
      project.paper
        ? `<a href="${project.paper}" class="project-card-btn project-card-btn--secondary" target="_blank">Paper <i class="fas fa-external-link-alt"></i></a>`
        : "",
    ]
      .filter(Boolean)
      .join("");

    card.innerHTML = `
      ${thumbnailHTML}
      <div class="project-card-body">
        <h3 class="project-card-title">${project.title}</h3>
        <p class="project-card-desc">${project.description}</p>
        ${tagsHTML}
        ${linksHTML ? `<div class="project-card-links">${linksHTML}</div>` : ""}
      </div>
    `;

    container.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", renderProjects);
