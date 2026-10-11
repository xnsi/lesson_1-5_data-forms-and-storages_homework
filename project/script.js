const cardForm = document.querySelector(".card-form");
const statePanels = document.querySelectorAll("[data-state-panel]");
const workspaceStatus = document.querySelector(".workspace__status");
const cardFields = document.querySelectorAll("[data-card-field]");
const createButton = document.querySelector('[data-action="create"]');
const editButton = document.querySelector('[data-action="edit"]');
const cancelButton = document.querySelector('[data-action="cancel"]');
const deleteButton = document.querySelector('[data-action="delete"]');
let card = null;

function showState(state) {
  statePanels.forEach((panel) => {
    panel.hidden = panel.dataset.statePanel !== state;
  });

  workspaceStatus.textContent = {
    empty: "Карточки нет",
    editor: "Редактирование",
    viewer: "Карточка сохранена",
  }[state];
}

function renderCard() {
  cardFields.forEach((field) => {
    field.textContent = card[field.dataset.cardField] || "Не указано";
  });
}

function openEditor() {
  cardForm.reset();

  if (card) {
    Object.entries(card).forEach(([name, value]) => {
      cardForm.elements.namedItem(name).value = value;
    });
  }

  showState("editor");
  cardForm.elements.namedItem("title").focus();
}

createButton.addEventListener("click", openEditor);
editButton.addEventListener("click", openEditor);

cardForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(cardForm);

  card = {
    title: formData.get("title"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    note: formData.get("note"),
  };

  renderCard();
  showState("viewer");
  editButton.focus();
});

cancelButton.addEventListener("click", () => {
  showState(card ? "viewer" : "empty");
  (card ? editButton : createButton).focus();
});

deleteButton.addEventListener("click", () => {
  card = null;
  cardForm.reset();
  showState("empty");
  createButton.focus();
});

showState("empty");

