const AppState = {
    allPositions: [],
    allTags: [],
    positionTagFilters: [],
    quizTagFilters: [],
    quizQueue: [],
    quizCurrent: null,
    quizCorrect: 0,
    quizTotal: 0,
    currentDetailId: null,
    currentDetailFen: null,
    boardFlipped: false,
    detailFlipped: false,
    boardFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    lastTags: '',
    allGames: [],
    gameTagFilters: [],
    gameCollectionFilter: null,
    gameResultFilter: '',
    gameSearch: '',
    gamePage: 0,
    gamePageSize: 50,
    gameTotalCount: 0,
    allCollections: [],
    currentGame: null,
    currentPly: 0,
    soundMuted: false,
    batchMode: false,
    batchCollectionId: null,
    batchCollectionName: null,
    batchGameIds: [],
    batchIndex: 0,
    searchFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    selectedGameIds: new Set(),
    addPositionType: 'tabiya',
    featuredCategoryId: null,
    currentCategory: null,
    gameStarredFilter: false,
    positionSort: 'newest',
};

const CATEGORIES = {
    tactics:  { key: 'tactics',  label: 'Tactics',  positionType: 'puzzle',   urlPrefix: '/tactics',  addLabel: 'New Tactic' },
    tabiya:   { key: 'tabiya',   label: 'Tabiya',   positionType: 'tabiya',   urlPrefix: '/tabiya',   addLabel: 'New Tabiya' },
    endings:  { key: 'endings',  label: 'Endings',  positionType: 'endgame',  urlPrefix: '/endings',  addLabel: 'New Ending' },
    strategy: { key: 'strategy', label: 'Strategy', positionType: 'strategy', urlPrefix: '/strategy', addLabel: 'New Strategy' },
};

const TYPE_TO_CATEGORY = {
    puzzle: 'tactics',
    tabiya: 'tabiya',
    endgame: 'endings',
    strategy: 'strategy',
};

window.AppState = AppState;
window.CATEGORIES = CATEGORIES;
window.TYPE_TO_CATEGORY = TYPE_TO_CATEGORY;
