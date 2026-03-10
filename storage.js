const KEYS = {
  HOSTED_ROOM_ID: "hosted_room_id",
  PLAYER_ID: "player_id",
  PLAYER_NAME: "player_name",
  PLAYER_ICON: "player_icon",
  MY_BOARD: "my_board",
};

export const Storage = {
  getHostedRoomId: () => localStorage.getItem(KEYS.HOSTED_ROOM_ID),
  setHostedRoomId: (id) => localStorage.setItem(KEYS.HOSTED_ROOM_ID, id),

  getPlayerId: () => localStorage.getItem(KEYS.PLAYER_ID),
  setPlayerId: (id) => localStorage.setItem(KEYS.PLAYER_ID, id),

  getPlayerName: () => localStorage.getItem(KEYS.PLAYER_NAME),
  setPlayerName: (name) => localStorage.setItem(KEYS.PLAYER_NAME, name),

  getPlayerIcon: () => localStorage.getItem(KEYS.PLAYER_ICON),
  setPlayerIcon: (icon) => localStorage.setItem(KEYS.PLAYER_ICON, icon),

  getBoard: () => JSON.parse(localStorage.getItem(KEYS.MY_BOARD) || "[]"),
  setBoard: (state) =>
    localStorage.setItem(KEYS.MY_BOARD, JSON.stringify(state)),

  clear: () => localStorage.clear(),
};
