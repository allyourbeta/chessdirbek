const PracticeViewerActions = {
    execute(action) {
        switch (action) {
            case 'first':
                PracticeViewer.first();
                break;
            case 'prev':
                PracticeViewer.prev();
                break;
            case 'next':
                PracticeViewer.next();
                break;
            case 'last':
                PracticeViewer.last();
                break;
            case 'flip':
                PracticeViewer.flip();
                break;
            case 'edit-verdict':
                PracticeViewer.editVerdict();
                break;
            case 'remove':
                PracticeViewer.remove();
                break;
        }
    }
};