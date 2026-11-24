import { useState } from "react";
import { Search, Star } from "lucide-react";
import { categories, icons, ids, keywords, type Id } from "./registry";
import type { Key } from "../locales";
export default function ToolCatalog({
  t,
  onSelect,
  favorites,
  onFavorite,
}: {
  t: (key: Key) => string;
  onSelect: (id: Id) => void;
  favorites: Id[];
  onFavorite: (id: Id) => void;
}) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState<Key | "all">("all");
  const filtered = categories
    .flatMap((c) => c.ids)
    .filter(
      (id) =>
        (category === "all" ||
          categories.find((c) => c.key === category)?.ids.includes(id)) &&
        (t(id) + " " + keywords[id] + " " + t((id + "Desc") as Key))
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    );
  return (
    <div className="tool-catalog">
      <div className="catalog-heading">
        <div>
          <h1>{t("allTools")}</h1>
          <p>{t("catalogHint")}</p>
        </div>
        <span>
          {ids.length} {t("toolCount")}
        </span>
      </div>
      <label className="catalog-search">
        <Search size={18} />
        <input
          aria-label={t("catalogSearch")}
          placeholder={t("catalogSearch")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div
        className="catalog-categories"
        role="group"
        aria-label={t("categoriesLabel")}
      >
        <button
          aria-pressed={category === "all"}
          onClick={() => setCategory("all")}
        >
          {t("allTools")} {ids.length}
        </button>
        {categories.map((c) => (
          <button
            key={c.key}
            aria-pressed={category === c.key}
            onClick={() => setCategory(c.key)}
          >
            {t(c.key)} {c.ids.length}
          </button>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="empty">{t("catalogNoResults")}</p>
      )}
      <div className="catalog-grid">
        {filtered.map((id) => {
          const Icon = icons[id];
          return (
            <article key={id} className="catalog-card">
              <button className="catalog-open" onClick={() => onSelect(id)}>
                <span className="catalog-icon">
                  <Icon size={24} />
                </span>
                <span>
                  <strong>{t(id)}</strong>
                  <small>{t((id + "Desc") as Key)}</small>
                </span>
              </button>
              <button
                className="catalog-favorite icon-button"
                aria-label={
                  t(favorites.includes(id) ? "unfavorite" : "favorite") +
                  " · " +
                  t(id)
                }
                aria-pressed={favorites.includes(id)}
                onClick={() => onFavorite(id)}
              >
                <Star
                  size={16}
                  fill={favorites.includes(id) ? "currentColor" : "none"}
                />
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
