const MoveCounts = (function () {
    function fullMoveCountFromPlies(plyCount) {
        return Math.ceil((Number(plyCount) || 0) / 2);
    }

    function formatMoveCountFromPlies(plyCount, includePlyDetail = false) {
        const plies = Number(plyCount) || 0;
        const moves = fullMoveCountFromPlies(plies);
        const moveLabel = moves === 1 ? 'move' : 'moves';
        if (!includePlyDetail) return `${moves} ${moveLabel}`;
        const plyLabel = plies === 1 ? 'ply' : 'plies';
        return `${moves} ${moveLabel} (${plies} ${plyLabel})`;
    }

    function formatAverageMoveCountFromPlies(avgPlies) {
        const plies = Number(avgPlies) || 0;
        return `${(plies / 2).toFixed(1)} moves`;
    }

    return {
        fullMoveCountFromPlies: fullMoveCountFromPlies,
        formatMoveCountFromPlies: formatMoveCountFromPlies,
        formatAverageMoveCountFromPlies: formatAverageMoveCountFromPlies,
    };
})();

window.MoveCounts = MoveCounts;
