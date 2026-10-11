const CARDS_STORAGE_KEY = "event-cards";
const HINT_SESSION_KEY = "event-card:hint-shown";
const DRAFT_SESSION_KEY = "event-card:draft";
const CARD_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

const cardForm = document.querySelector(".card-form");
const sessionHint = document.querySelector("[data-session-hint]");
const draftNotice = document.querySelector("[data-draft-status]");
const expiryNotice = document.querySelector("[data-expiry-notice]");
const statePanels = document.querySelectorAll("[data-state-panel]");
const workspaceStatus = document.querySelector(".workspace__status");
const cardFields = document.querySelectorAll("[data-card-field]");
const cardList = document.querySelector("[data-card-list]");
const createButtons = document.querySelectorAll('[data-action="create"]');
const editButton = document.querySelector('[data-action="edit"]');
const cancelButton = document.querySelector('[data-action="cancel"]');
const deleteButton = document.querySelector('[data-action="delete"]');
let cards = [];
let selectedId = null;
let editingId = null;

function showState(state) {
  statePanels.forEach((panel) => {
    panel.hidden = panel.dataset.statePanel !== state;
  });

  workspaceStatus.textContent = {
    empty: "Карточек нет",
    editor: "Редактирование",
    viewer: `Сохранено мероприятий: ${cards.length}`,
  }[state];
}

function renderCard() {
  const card = cards.find((item) => item.id === selectedId);

  cardFields.forEach((field) => {
    field.textContent = card[field.dataset.cardField] || "Не указано";
  });
  cardList.querySelectorAll("[data-card-id]").forEach((button) => {
    button.setAttribute("aria-current", button.dataset.cardId === selectedId ? "true" : "false");
  });
}

function renderCollection() {
  if (!cards.some((card) => card.id === selectedId)) {
    selectedId = cards[0]?.id ?? null;
  }

  cardList.replaceChildren();
  cards.forEach((card) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    item.className = "card-list__item";
    button.className = "button button--secondary card-list__button";
    button.type = "button";
    button.dataset.cardId = card.id;
    button.textContent = card.title;
    button.addEventListener("click", () => {
      selectedId = card.id;
      renderCard();
    });
    item.append(button);
    cardList.append(item);
  });

  if (cards.length) {
    renderCard();
    showState("viewer");
  } else {
    showState("empty");
  }
}

function openEditor(id) {
  editingId = id;
  cardForm.reset();
  const card = cards.find((item) => item.id === id);

  if (card) {
    cardFields.forEach((field) => {
      const name = field.dataset.cardField;
      cardForm.elements.namedItem(name).value = card[name];
    });
  }

  validateDates();
  showState("editor");
  cardForm.elements.namedItem("title").focus();
}

function saveCards(nextCards) {
  try {
    if (nextCards.length) {
      localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(nextCards));
    } else {
      localStorage.removeItem(CARDS_STORAGE_KEY);
    }
  } catch {
    workspaceStatus.textContent = "Не удалось сохранить изменения. Попробуйте еще раз.";
    return false;
  }

  cards = nextCards;
  expiryNotice.hidden = true;
  return true;
}

function readCard(data) {
  if (
    data === null ||
    typeof data !== "object" ||
    !["title", "startDate", "endDate", "note"].every(
      (name) => typeof data[name] === "string",
    ) ||
    data.title.length < 3 ||
    data.title.length > 100 ||
    !data.startDate ||
    !data.endDate ||
    data.note.length > 500
  ) {
    throw new Error("Неверный формат карточки");
  }

  return {
    title: data.title,
    startDate: data.startDate,
    endDate: data.endDate,
    note: data.note,
  };
}

function getFormValues() {
  return Object.fromEntries(new FormData(cardForm));
}

function validateDates() {
  const startDate = cardForm.elements.namedItem("startDate");
  const endDate = cardForm.elements.namedItem("endDate");
  endDate.setCustomValidity(
    startDate.value && endDate.value && endDate.valueAsNumber < startDate.valueAsNumber
      ? "Дата окончания не может быть раньше даты начала."
      : "",
  );
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_SESSION_KEY);
    draftNotice.hidden = true;
  } catch {
    draftNotice.hidden = false;
    draftNotice.textContent = "Не удалось удалить черновик.";
  }
}

function restoreDraft() {
  try {
    const savedDraft = sessionStorage.getItem(DRAFT_SESSION_KEY);
    if (savedDraft === null) {
      return;
    }

    const draft = JSON.parse(savedDraft);
    if (
      [...cardFields].some((field) => typeof draft?.[field.dataset.cardField] !== "string") ||
      (draft.id !== null && typeof draft.id !== "string")
    ) {
      throw new Error("Неверный формат черновика");
    }

    const id = cards.some((card) => card.id === draft.id) ? draft.id : null;
    openEditor(id);
    cardFields.forEach((field) => {
      const name = field.dataset.cardField;
      cardForm.elements.namedItem(name).value = draft[name];
    });
    validateDates();
    draftNotice.hidden = false;
    draftNotice.textContent = draft.id !== null && id === null
      ? "Карточка удалена или устарела. Черновик восстановлен как новая карточка."
      : "Черновик восстановлен в этой вкладке.";
  } catch {
    draftNotice.hidden = false;
    draftNotice.textContent = "Не удалось восстановить черновик.";
  }
}

cardForm.addEventListener("input", () => {
  validateDates();
  draftNotice.hidden = false;
  try {
    const draft = { id: editingId, ...getFormValues() };
    sessionStorage.setItem(DRAFT_SESSION_KEY, JSON.stringify(draft));
    draftNotice.textContent = "Черновик сохранен в этой вкладке.";
  } catch {
    draftNotice.textContent = "Не удалось сохранить черновик. Значения остались в форме.";
  }
});
cardForm.addEventListener("change", validateDates);

createButtons.forEach((button) => {
  button.addEventListener("click", () => openEditor(null));
});
editButton.addEventListener("click", () => openEditor(selectedId));

cardForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (
    editingId !== null &&
    !cards.some((card) => card.id === editingId && Date.now() - card.savedAt < CARD_LIFETIME_MS)
  ) {
    workspaceStatus.textContent = "Карточка удалена или устарела. Отмените редактирование.";
    return;
  }

  validateDates();
  if (!cardForm.reportValidity()) {
    return;
  }

  let values;
  try {
    values = readCard(getFormValues());
  } catch {
    workspaceStatus.textContent = "Проверьте название (3–100 символов), даты и длину заметки.";
    return;
  }

  const newCard = {
    id: editingId ?? crypto.randomUUID(),
    ...values,
    savedAt: Date.now(),
  };
  const nextCards = editingId === null
    ? [...cards, newCard]
    : cards.map((card) => card.id === editingId ? newCard : card);

  if (!saveCards(nextCards)) {
    return;
  }

  selectedId = newCard.id;
  editingId = null;
  renderCollection();
  clearDraft();
  editButton.focus();
});

cancelButton.addEventListener("click", () => {
  editingId = null;
  renderCollection();
  clearDraft();
  (cards.length ? editButton : createButtons[0]).focus();
});

deleteButton.addEventListener("click", () => {
  const nextCards = cards.filter((card) => card.id !== selectedId);

  if (!saveCards(nextCards)) {
    return;
  }

  editingId = null;
  cardForm.reset();
  renderCollection();
  clearDraft();
  (cards.length ? editButton : createButtons[0]).focus();
});

function restoreCards() {
  try {
    const savedCards = localStorage.getItem(CARDS_STORAGE_KEY);

    if (savedCards !== null) {
      const data = JSON.parse(savedCards);
      if (!Array.isArray(data)) {
        throw new Error("Неверный формат коллекции");
      }

      const restoredCards = data.map((item) => {
        const values = readCard(item);
        if (typeof item.id !== "string" || !item.id || !Number.isFinite(item.savedAt)) {
          throw new Error("Неверный идентификатор или время сохранения карточки");
        }
        return { id: item.id, ...values, savedAt: item.savedAt };
      });
      if (new Set(restoredCards.map((card) => card.id)).size !== restoredCards.length) {
        throw new Error("Повторяющиеся идентификаторы карточек");
      }
      cards = restoredCards.filter((card) => Date.now() - card.savedAt < CARD_LIFETIME_MS);
      expiryNotice.hidden = cards.length === restoredCards.length;
    } else {
      cards = [];
      expiryNotice.hidden = true;
    }
  } catch {
    workspaceStatus.textContent = "Не удалось восстановить коллекцию. Можно создать новую.";
    return false;
  }

  renderCollection();
  return true;
}

showState("empty");
restoreCards();
restoreDraft();

// storage приходит в другие вкладки. Здесь только читаем, чтобы не создавать цикл.
window.addEventListener("storage", (event) => {
  if (
    event.storageArea !== localStorage ||
    (event.key !== CARDS_STORAGE_KEY && event.key !== null)
  ) {
    return;
  }

  const wasEditing = !cardForm.closest("[data-state-panel]").hidden;
  if (!restoreCards()) {
    return;
  }

  if (wasEditing) {
    showState("editor");
  }
  workspaceStatus.textContent = wasEditing
    ? "Карточки изменены в другой вкладке. Ваши правки остались в форме."
    : "Карточки обновлены из другой вкладки.";
});

try {
  sessionHint.hidden = sessionStorage.getItem(HINT_SESSION_KEY) === "1";
  if (!sessionHint.hidden) {
    sessionStorage.setItem(HINT_SESSION_KEY, "1");
  }
} catch {
  sessionHint.hidden = false;
}
