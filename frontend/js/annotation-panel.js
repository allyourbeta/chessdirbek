const AnnotationPanel = (function () {
    let _containerId = null;
    let _currentFen = null;
    let _loadedText = '';
    let _draftText = '';
    let _loadedQuestion = '';
    let _draftQuestion = '';
    let _isDirty = false;
    let _isSaving = false;
    let _loadVersion = 0;
    let _debounceTimer = null;
    let _statusTimer = null;

    function mount(containerId) {
        if (_containerId === containerId) return;
        if (_containerId) unmount();

        var container = document.getElementById(containerId);
        if (!container) return;
        _containerId = containerId;

        // SAFE_INNER_HTML: Static template with controlled button actions.
        // The question is a prompt to focus your thinking (never blurred);
        // the note below it is the answer (blurred until clicked).
        container.innerHTML =
            '<div class="annotation-panel">' +
                '<label class="annotation-label" for="annotation-question">Question (optional)</label>' +
                '<textarea class="annotation-question" id="annotation-question" ' +
                    'placeholder="Optional prompt to focus your thinking here..."></textarea>' +
                '<label class="annotation-label">Position notes</label>' +
                '<textarea class="annotation-textarea" id="annotation-textarea" ' +
                    'placeholder="Notes for this position..."></textarea>' +
                '<div class="annotation-status" id="annotation-status"></div>' +
            '</div>';

        var ta = document.getElementById('annotation-textarea');
        if (ta) {
            ta.addEventListener('input', _onInput);
            ta.addEventListener('blur', _onBlur);
            ta.addEventListener('click', _onRevealClick);
        }
        var q = document.getElementById('annotation-question');
        if (q) {
            q.addEventListener('input', _onQuestionInput);
            q.addEventListener('blur', _onBlur);
        }
    }

    function setPosition(fen) {
        if (!_containerId) return;
        if (_isDirty && _currentFen) {
            _save(_currentFen);
        }
        _currentFen = fen;
        _loadedText = '';
        _draftText = '';
        _loadedQuestion = '';
        _draftQuestion = '';
        _isDirty = false;
        _clearDebounce();
        _loadVersion++;
        var myVersion = _loadVersion;
        _setTextarea('');
        _setQuestion('');
        _setStatus('');

        // Clear blur class at start (before async load)
        var ta = document.getElementById('annotation-textarea');
        if (ta) {
            ta.classList.remove('blurred');
        }

        ApiClient.get('/annotations/', { fen })
            .then(function (data) {
                if (myVersion !== _loadVersion) return;
                _loadedText = data.note_text || '';
                _draftText = _loadedText;
                _loadedQuestion = data.question_text || '';
                _draftQuestion = _loadedQuestion;
                _setTextarea(_loadedText);
                _setQuestion(_loadedQuestion);

                // Apply blur to the NOTE only (the answer). The question is a
                // prompt and is always shown.
                var ta = document.getElementById('annotation-textarea');
                if (ta) {
                    if (_loadedText) {
                        ta.classList.add('blurred');
                        ta.readOnly = true;
                    } else {
                        ta.classList.remove('blurred');
                        ta.readOnly = false;
                    }
                }
            })
            .catch(function () {
                if (myVersion !== _loadVersion) return;
            });
    }

    function unmount() {
        if (!_containerId) return;
        if (_isDirty && _currentFen) {
            _save(_currentFen);
        }
        _clearDebounce();
        var ta = document.getElementById('annotation-textarea');
        if (ta) {
            ta.removeEventListener('input', _onInput);
            ta.removeEventListener('blur', _onBlur);
            ta.removeEventListener('click', _onRevealClick);
        }
        var q = document.getElementById('annotation-question');
        if (q) {
            q.removeEventListener('input', _onQuestionInput);
            q.removeEventListener('blur', _onBlur);
        }
        var container = document.getElementById(_containerId);
        // SAFE_INNER_HTML: Clearing element content
        if (container) container.innerHTML = '';
        _containerId = null;
        _currentFen = null;
        _loadedText = '';
        _draftText = '';
        _loadedQuestion = '';
        _draftQuestion = '';
        _isDirty = false;
        _isSaving = false;
        _loadVersion = 0;
    }

    function _onRevealClick(e) {
        var ta = document.getElementById('annotation-textarea');
        if (ta && ta.classList.contains('blurred')) {
            e.preventDefault();
            ta.classList.remove('blurred');
            ta.readOnly = false;
            // Don't focus or place cursor on the reveal click —
            // let the user click again to start editing
        }
    }

    function _recomputeDirty() {
        _isDirty = (_draftText !== _loadedText) || (_draftQuestion !== _loadedQuestion);
        _clearDebounce();
        if (_isDirty) {
            _debounceTimer = setTimeout(_debounceSave, 1500);
        }
    }

    function _onInput() {
        var ta = document.getElementById('annotation-textarea');
        if (!ta) return;
        _draftText = ta.value;
        _recomputeDirty();
    }

    function _onQuestionInput() {
        var q = document.getElementById('annotation-question');
        if (!q) return;
        _draftQuestion = q.value;
        _recomputeDirty();
    }

    function _onBlur() {
        if (_isDirty && _currentFen) {
            _clearDebounce();
            _save(_currentFen);
        }
    }

    function _debounceSave() {
        if (_isDirty && _currentFen) {
            _save(_currentFen);
        }
    }

    function _clearDebounce() {
        if (_debounceTimer) {
            clearTimeout(_debounceTimer);
            _debounceTimer = null;
        }
    }

    function _save(fen) {
        if (_isSaving) return;
        _isSaving = true;
        _setStatus('Saving...');

        var noteToSave = _draftText;
        var questionToSave = _draftQuestion;

        ApiClient.put('/annotations/', {
            fen: fen,
            note_text: noteToSave,
            question_text: questionToSave,
        })
            .then(function () {
                _loadedText = noteToSave;
                _loadedQuestion = questionToSave;
                _isDirty = false;
                _isSaving = false;
                _showSaved();
            })
            .catch(function () {
                _isSaving = false;
                _setStatus('Save failed');
            });
    }

    function _showSaved() {
        _setStatus('Saved \u2713');
        if (_statusTimer) clearTimeout(_statusTimer);
        _statusTimer = setTimeout(function () {
            _setStatus('');
            _statusTimer = null;
        }, 2000);
    }

    function _setTextarea(val) {
        var ta = document.getElementById('annotation-textarea');
        if (ta) ta.value = val;
    }

    function _setQuestion(val) {
        var q = document.getElementById('annotation-question');
        if (q) q.value = val;
    }

    function _setStatus(msg) {
        var el = document.getElementById('annotation-status');
        if (el) el.textContent = msg;
    }

    return {
        mount: mount,
        setPosition: setPosition,
        unmount: unmount,
    };
})();

window.AnnotationPanel = AnnotationPanel;
