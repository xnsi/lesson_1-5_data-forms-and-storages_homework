const CARDS_STORAGE_KEY = "event-cards";
const HINT_SESSION_KEY = "event-card:hint-shown";

const cardForm = document.querySelector(".card-form");
const sessionHint = document.querySelector("[data-session-hint]");
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

createButtons.forEach((button) => {
  button.addEventListener("click", () => openEditor(null));
});
editButton.addEventListener("click", () => openEditor(selectedId));

cardForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (editingId !== null && !cards.some((card) => card.id === editingId)) {
    workspaceStatus.textContent = "Карточка удалена в другой вкладке. Отмените редактирование.";
    return;
  }

  const formData = new FormData(cardForm);
  const newCard = {
    id: editingId ?? crypto.randomUUID(),
    title: formData.get("title"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    note: formData.get("note"),
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
  editButton.focus();
});

cancelButton.addEventListener("click", () => {
  editingId = null;
  renderCollection();
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
        if (typeof item.id !== "string" || !item.id) {
          throw new Error("Неверный идентификатор карточки");
        }
        return { id: item.id, ...values };
      });
      if (new Set(restoredCards.map((card) => card.id)).size !== restoredCards.length) {
        throw new Error("Повторяющиеся идентификаторы карточек");
      }
      cards = restoredCards;
    } else {
      cards = [];
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
