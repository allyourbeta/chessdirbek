const Navigation = (function () {
    let _appBackEntries = 0;

    function reset() {
        _appBackEntries = 0;
    }

    function recordPush() {
        _appBackEntries += 1;
    }

    function recordPop() {
        _appBackEntries = Math.max(0, _appBackEntries - 1);
    }

    function cancelToFallback(fallbackRoute) {
        if (_appBackEntries > 0) {
            history.back();
            return;
        }
        if (window.Router && fallbackRoute) {
            Router.navigate(fallbackRoute, { replace: true });
        }
    }

    return {
        reset: reset,
        recordPush: recordPush,
        recordPop: recordPop,
        cancelToFallback: cancelToFallback,
    };
})();

window.Navigation = Navigation;
