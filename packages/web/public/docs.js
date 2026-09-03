const shell = document.querySelector(".docs-shell");
const content = document.getElementById("docs-content");
const sidebar = document.getElementById("docs-sidebar");
const menuButton = document.getElementById("menu-button");
const backdrop = document.getElementById("sidebar-backdrop");
const search = document.getElementById("docs-search");
const searchResults = document.getElementById("search-results");
const sections = [...document.querySelectorAll(".doc-section")];
const navigationLinks = [...document.querySelectorAll(".docs-sidebar a, .page-toc a")];

const closeNavigation = () => shell?.classList.remove("nav-open");

menuButton?.addEventListener("click", () => shell?.classList.toggle("nav-open"));
backdrop?.addEventListener("click", closeNavigation);
sidebar?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeNavigation));

const setActiveSection = (id) => {
  navigationLinks.forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
  });
};

const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible?.target.id) setActiveSection(visible.target.id);
  },
  { root: content, rootMargin: "-8% 0px -68% 0px", threshold: [0, 0.08, 0.25] },
);

sections.forEach((section) => observer.observe(section));

const searchIndex = sections.map((section) => ({
  id: section.id,
  title: section.dataset.title ?? section.querySelector("h2, h1")?.textContent ?? section.id,
  text: (section.textContent ?? "").replace(/\s+/g, " ").trim(),
}));

const navigateTo = (id) => {
  const target = document.getElementById(id);
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
  setActiveSection(id);
  searchResults.hidden = true;
  search.value = "";
};

const addSearchResult = (entry, query) => {
  const button = document.createElement("button");
  button.type = "button";
  const title = document.createElement("b");
  title.textContent = entry.title;
  const excerpt = document.createElement("span");
  const normalized = entry.text.toLowerCase();
  const matchAt = normalized.indexOf(query);
  const start = Math.max(0, matchAt - 55);
  const end = Math.min(entry.text.length, start + 145);
  excerpt.textContent = `${start > 0 ? "..." : ""}${entry.text.slice(start, end)}${end < entry.text.length ? "..." : ""}`;
  button.append(title, excerpt);
  button.addEventListener("click", () => navigateTo(entry.id));
  searchResults.append(button);
};

const renderSearch = () => {
  const query = search.value.trim().toLowerCase();
  searchResults.replaceChildren();
  if (query.length < 2) {
    searchResults.hidden = true;
    return;
  }
  const matches = searchIndex
    .filter((entry) => entry.title.toLowerCase().includes(query) || entry.text.toLowerCase().includes(query))
    .slice(0, 8);
  if (matches.length === 0) {
    const empty = document.createElement("div");
    empty.className = "search-empty";
    empty.textContent = "No documentation section matches this search.";
    searchResults.append(empty);
  } else {
    matches.forEach((entry) => addSearchResult(entry, query));
  }
  searchResults.hidden = false;
};

search?.addEventListener("input", renderSearch);
search?.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    search.value = "";
    searchResults.hidden = true;
    search.blur();
  }
  if (event.key === "Enter") {
    const first = searchResults.querySelector("button");
    if (first) {
      event.preventDefault();
      first.click();
    }
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-wrap")) searchResults.hidden = true;
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== search) {
    event.preventDefault();
    search?.focus();
  }
});

const initialId = location.hash.slice(1);
if (initialId && document.getElementById(initialId)) {
  requestAnimationFrame(() => navigateTo(initialId));
}
