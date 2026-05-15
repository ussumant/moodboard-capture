import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  const libraryRoot = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('libraryRoot');
  }, []);

  const [board, setBoard] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBoard() {
      if (!libraryRoot) {
        setError('Missing libraryRoot in viewer URL.');
        return;
      }

      try {
        setError(null);
        const response = await fetch(`/api/board?libraryRoot=${encodeURIComponent(libraryRoot)}`);
        if (!response.ok) {
          throw new Error(`Board request failed (${response.status})`);
        }
        const payload = await response.json();
        if (!cancelled) {
          setBoard(payload);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Failed to load board.');
        }
      }
    }

    loadBoard();
    return () => {
      cancelled = true;
    };
  }, [libraryRoot]);

  const captures = useMemo(() =>
    (board?.manifest?.items || []).filter((item) => item.kind === 'capture')
  , [board]);

  const groups = useMemo(() => board?.manifest?.groups || [], [board]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    if (!captures.some((item) => item.id === selectedId)) {
      setSelectedId(null);
    }
  }, [captures, selectedId]);

  const selectedCapture = captures.find((item) => item.id === selectedId) || null;

  if (error) {
    return (
      <div className="board-error">
        <div className="board-error__panel">
          <h1>Board failed to load</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="board-loading">
        <div className="board-loading__panel">
          <h1>Opening moodboard board</h1>
          <p>Loading the active library and preparing the ingredient board.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="board-app">
      <div className="board-stage">
        <div
          className="board-surface"
          style={{
            '--board-bg': `url("${board.manifest.backgroundUrl}")`,
          }}
        >
          <div className="board-overlay">
            {groups.map((group) => {
              const items = captures
                .filter((item) => item.primaryGroup === group.id)
                .sort((left, right) => {
                  if (left.viewerPriority !== right.viewerPriority) {
                    return right.viewerPriority - left.viewerPriority;
                  }
                  return String(left.title || '').localeCompare(String(right.title || ''));
                });

              return (
                <section
                  key={group.id}
                  className="board-group"
                  data-tone={group.tone}
                  data-group={group.id}
                >
                  <div className="board-group__header">
                    <p className="board-group__eyebrow">{group.label}</p>
                    <p className="board-group__description">{group.description}</p>
                  </div>
                  <div className="board-group__grid">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`board-card ${selectedId === item.id ? 'is-selected' : ''}`}
                        data-tone={item.cardAccent}
                        data-source={item.sourceType === 'local-image' ? 'landscape' : 'portrait'}
                        style={{
                          '--card-rotation': `${item.layout?.rotation || 0}rad`,
                        }}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <div className="board-card__image-shell">
                          <img
                            className="board-card__image"
                            src={item.assetUrl}
                            alt={item.title || 'Moodboard reference'}
                            loading="lazy"
                          />
                        </div>
                        <div className="board-card__meta">
                          <div className="board-card__chips">
                            {(item.groupTags || []).slice(0, 2).map((tag) => (
                              <span
                                key={`${item.id}-${tag.label}`}
                                className="board-chip"
                                data-tone={tag.tone}
                              >
                                {tag.label}
                              </span>
                            ))}
                          </div>
                          <div className="board-card__title-row">
                            <span className="board-card__title">{item.title}</span>
                            <span className="board-card__group">{group.label}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>

      <aside className={`board-sidebar ${selectedCapture ? 'is-open' : ''}`}>
        {selectedCapture ? (
          <>
            <div className="board-sidebar__header">
              <div>
                <p className="board-sidebar__eyebrow">{groupLabel(groups, selectedCapture.primaryGroup)}</p>
                <h2>{selectedCapture.title}</h2>
              </div>
              <button
                type="button"
                className="board-sidebar__close"
                onClick={() => setSelectedId(null)}
              >
                Close
              </button>
            </div>

            <section className="board-sidebar__section">
              <h3>Why it stood out</h3>
              <p>{selectedCapture.detailSections?.whyItStoodOut || 'Saved as a taste reference.'}</p>
            </section>

            <section className="board-sidebar__section">
              <h3>Primary ingredients</h3>
              <div className="board-sidebar__chips">
                {(selectedCapture.detailSections?.primaryIngredients || []).map((value) => (
                  <span key={value} className="board-chip" data-tone={selectedCapture.cardAccent}>
                    {value}
                  </span>
                ))}
              </div>
            </section>

            {(selectedCapture.detailSections?.secondaryIngredients || []).length > 0 ? (
              <section className="board-sidebar__section">
                <h3>Secondary ingredients</h3>
                <div className="board-sidebar__chips">
                  {selectedCapture.detailSections.secondaryIngredients.map((value) => (
                    <span key={value} className="board-chip board-chip--subtle" data-tone="neutral">
                      {value}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {(selectedCapture.detailSections?.topSignals || []).length > 0 ? (
              <section className="board-sidebar__section">
                <h3>Signals</h3>
                <ul className="board-sidebar__list">
                  {selectedCapture.detailSections.topSignals.map((value) => (
                    <li key={value}>{value}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {(selectedCapture.detailSections?.relatedArtifacts || []).length > 0 ? (
              <section className="board-sidebar__section">
                <h3>Related artifacts</h3>
                <ul className="board-sidebar__artifacts">
                  {selectedCapture.detailSections.relatedArtifacts.map((artifact) => (
                    <li key={`${artifact.label}-${artifact.path}`}>
                      <span>{artifact.label}</span>
                      <a href={toFileHref(artifact.path)}>{artifact.path}</a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : (
          <div className="board-sidebar__empty">
            <p className="board-sidebar__eyebrow">Ingredient board</p>
            <h2>Select a capture</h2>
            <p>Open any card to inspect why it stood out, the extracted ingredients, and the related local design artifacts.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function groupLabel(groups, groupId) {
  return groups.find((group) => group.id === groupId)?.label || groupId;
}

function toFileHref(filePath) {
  return `file://${encodeURI(filePath)}`;
}

createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
