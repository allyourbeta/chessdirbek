const API = '/api';
const PIECE_SVG = {
    "wK": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSIxLjUiPjxwYXRoIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiIGQ9Ik0yMi41IDExLjYzVjZNMjAgOGg1Ii8+PHBhdGggZmlsbD0iI2ZmZiIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiIGQ9Ik0yMi41IDI1czQuNS03LjUgMy0xMC41YzAgMC0xLTIuNS0zLTIuNXMtMyAyLjUtMyAyLjVjLTEuNSAzIDMgMTAuNSAzIDEwLjUiLz48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMTEuNSAzN2M1LjUgMy41IDE1LjUgMy41IDIxIDB2LTdzOS00LjUgNi0xMC41Yy00LTYuNS0xMy41LTMuNS0xNiA0VjI3di0zLjVjLTMuNS03LjUtMTMtMTAuNS0xNi00LTMgNiA1IDEwIDUgMTBWMzd6Ii8+PHBhdGggZD0iTTExLjUgMzBjNS41LTMgMTUuNS0zIDIxIDBtLTIxIDMuNWM1LjUtMyAxNS41LTMgMjEgMG0tMjEgMy41YzUuNS0zIDE1LjUtMyAyMSAwIi8+PC9nPjwvc3ZnPg==",
    "wQ": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSI+PGcgZmlsbD0iI2ZmZiIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSIxLjUiPjxwYXRoIGQ9Ik04IDEyYTIgMiAwIDEgMS00IDAgMiAyIDAgMSAxIDQgMHptMTYuNS00LjVhMiAyIDAgMSAxLTQgMCAyIDIgMCAxIDEgNCAwek00MSAxMmEyIDIgMCAxIDEtNCAwIDIgMiAwIDEgMSA0IDB6TTE2IDguNWEyIDIgMCAxIDEtNCAwIDIgMiAwIDEgMSA0IDB6TTMzIDlhMiAyIDAgMSAxLTQgMCAyIDIgMCAxIDEgNCAweiIvPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJidXR0IiBkPSJNOSAyNmM4LjUtMS41IDIxLTEuNSAyNyAwbDItMTItNyAxMVYxMWwtNS41IDEzLjUtMy0xNS0zIDE1LTUuNS0xNFYyNUw3IDE0bDIgMTJ6Ii8+PHBhdGggc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiIGQ9Ik05IDI2YzAgMiAxLjUgMiAyLjUgNCAxIDEuNSAxIDEgLjUgMy41LTEuNSAxLTEuNSAyLjUtMS41IDIuNS0xLjUgMS41LjUgMi41LjUgMi41IDYuNSAxIDE2LjUgMSAyMyAwIDAgMCAxLjUtMSAwLTIuNSAwIDAgLjUtMS41LTEtMi41LS41LTIuNS0uNS0yIC41LTMuNSAxLTIgMi41LTIgMi41LTQtOC41LTEuNS0xOC41LTEuNS0yNyAweiIvPjxwYXRoIGZpbGw9Im5vbmUiIGQ9Ik0xMS41IDMwYzMuNS0xIDE4LjUtMSAyMiAwTTEyIDMzLjVjNi0xIDE1LTEgMjEgMCIvPjwvZz48L3N2Zz4=",
    "wR": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSI+PGcgZmlsbD0iI2ZmZiIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSIxLjUiPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJidXR0IiBkPSJNOSAzOWgyN3YtM0g5djN6bTMtM3YtNGgyMXY0SDEyem0tMS0yMlY5aDR2Mmg1VjloNXYyaDVWOWg0djUiLz48cGF0aCBkPSJtMzQgMTQtMyAzSDE0bC0zLTMiLz48cGF0aCBzdHJva2UtbGluZWNhcD0iYnV0dCIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIgZD0iTTMxIDE3djEyLjVIMTRWMTciLz48cGF0aCBkPSJtMzEgMjkuNSAxLjUgMi41aC0yMGwxLjUtMi41Ii8+PHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIgZD0iTTExIDE0aDIzIi8+PC9nPjwvc3ZnPg==",
    "wB": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSIxLjUiPjxnIGZpbGw9IiNmZmYiIHN0cm9rZS1saW5lY2FwPSJidXR0Ij48cGF0aCBkPSJNOSAzNmMzLjM5LS45NyAxMC4xMS40MyAxMy41LTIgMy4zOSAyLjQzIDEwLjExIDEuMDMgMTMuNSAyIDAgMCAxLjY1LjU0IDMgMi0uNjguOTctMS42NS45OS0zIC41LTMuMzktLjk3LTEwLjExLjQ2LTEzLjUtMS0zLjM5IDEuNDYtMTAuMTEuMDMtMTMuNSAxLTEuMzUuNDktMi4zMi40Ny0zLS41IDEuMzUtMS45NCAzLTIgMy0yeiIvPjxwYXRoIGQ9Ik0xNSAzMmMyLjUgMi41IDEyLjUgMi41IDE1IDAgLjUtMS41IDAtMiAwLTIgMC0yLjUtMi41LTQtMi41LTQgNS41LTEuNSA2LTExLjUtNS0xNS41LTExIDQtMTAuNSAxNC01IDE1LjUgMCAwLTIuNSAxLjUtMi41IDQgMCAwLS41LjUgMCAyeiIvPjxwYXRoIGQ9Ik0yNSA4YTIuNSAyLjUgMCAxIDEtNSAwIDIuNSAyLjUgMCAxIDEgNSAweiIvPjwvZz48cGF0aCBzdHJva2UtbGluZWpvaW49Im1pdGVyIiBkPSJNMTcuNSAyNmgxME0xNSAzMGgxNW0tNy41LTE0LjV2NU0yMCAxOGg1Ii8+PC9nPjwvc3ZnPg==",
    "wN": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSIxLjUiPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0yMiAxMGMxMC41IDEgMTYuNSA4IDE2IDI5SDE1YzAtOSAxMC02LjUgOC0yMSIvPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0yNCAxOGMuMzggMi45MS01LjU1IDcuMzctOCA5LTMgMi0yLjgyIDQuMzQtNSA0LTEuMDQyLS45NCAxLjQxLTMuMDQgMC0zLTEgMCAuMTkgMS4yMy0xIDItMSAwLTQuMDAzIDEtNC00IDAtMiA2LTEyIDYtMTJzMS44OS0xLjkgMi0zLjVjLS43My0uOTk0LS41LTItLjUtMyAxLTEgMyAyLjUgMyAyLjVoMnMuNzgtMS45OTIgMi41LTNjMSAwIDEgMyAxIDMiLz48cGF0aCBmaWxsPSIjMDAwIiBkPSJNOS41IDI1LjVhLjUuNSAwIDEgMS0xIDAgLjUuNSAwIDEgMSAxIDB6bTUuNDMzLTkuNzVhLjUgMS41IDMwIDEgMS0uODY2LS41LjUgMS41IDMwIDEgMSAuODY2LjV6Ii8+PC9nPjwvc3ZnPg==",
    "wP": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSI+PHBhdGggZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS13aWR0aD0iMS41IiBkPSJNMjIuNSA5Yy0yLjIxIDAtNCAxLjc5LTQgNCAwIC44OS4yOSAxLjcxLjc4IDIuMzhDMTcuMzMgMTYuNSAxNiAxOC41OSAxNiAyMWMwIDIuMDMuOTQgMy44NCAyLjQxIDUuMDMtMyAxLjA2LTcuNDEgNS41NS03LjQxIDEzLjQ3aDIzYzAtNy45Mi00LjQxLTEyLjQxLTcuNDEtMTMuNDcgMS40Ny0xLjE5IDIuNDEtMyAyLjQxLTUuMDMgMC0yLjQxLTEuMzMtNC41LTMuMjgtNS42Mi40OS0uNjcuNzgtMS40OS43OC0yLjM4IDAtMi4yMS0xLjc5LTQtNC00eiIvPjwvc3ZnPg==",
    "bK": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSIxLjUiPjxwYXRoIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiIGQ9Ik0yMi41IDExLjZWNiIvPjxwYXRoIGZpbGw9IiMwMDAiIHN0cm9rZS1saW5lY2FwPSJidXR0IiBzdHJva2UtbGluZWpvaW49Im1pdGVyIiBkPSJNMjIuNSAyNXM0LjUtNy41IDMtMTAuNWMwIDAtMS0yLjUtMy0yLjVzLTMgMi41LTMgMi41Yy0xLjUgMyAzIDEwLjUgMyAxMC41Ii8+PHBhdGggZmlsbD0iIzAwMCIgZD0iTTExLjUgMzdhMjIuMyAyMi4zIDAgMCAwIDIxIDB2LTdzOS00LjUgNi0xMC41Yy00LTYuNS0xMy41LTMuNS0xNiA0VjI3di0zLjVjLTMuNS03LjUtMTMtMTAuNS0xNi00LTMgNiA1IDEwIDUgMTBWMzd6Ii8+PHBhdGggc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIgZD0iTTIwIDhoNSIvPjxwYXRoIHN0cm9rZT0iI2VjZWNlYyIgZD0iTTMyIDI5LjVzOC41LTQgNi05LjdDMzQuMSAxNCAyNSAxOCAyMi41IDI0LjZ2Mi4xLTIuMUMyMCAxOCA5LjkgMTQgNyAxOS45Yy0yLjUgNS42IDQuOCA5IDQuOCA5Ii8+PHBhdGggc3Ryb2tlPSIjZWNlY2VjIiBkPSJNMTEuNSAzMGM1LjUtMyAxNS41LTMgMjEgMG0tMjEgMy41YzUuNS0zIDE1LjUtMyAyMSAwbS0yMSAzLjVjNS41LTMgMTUuNS0zIDIxIDAiLz48L2c+PC9zdmc+",
    "bQ": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSI+PGcgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSIxLjUiPjxnIHN0cm9rZT0ibm9uZSI+PGNpcmNsZSBjeD0iNiIgY3k9IjEyIiByPSIyLjc1Ii8+PGNpcmNsZSBjeD0iMTQiIGN5PSI5IiByPSIyLjc1Ii8+PGNpcmNsZSBjeD0iMjIuNSIgY3k9IjgiIHI9IjIuNzUiLz48Y2lyY2xlIGN4PSIzMSIgY3k9IjkiIHI9IjIuNzUiLz48Y2lyY2xlIGN4PSIzOSIgY3k9IjEyIiByPSIyLjc1Ii8+PC9nPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJidXR0IiBkPSJNOSAyNmM4LjUtMS41IDIxLTEuNSAyNyAwbDIuNS0xMi41TDMxIDI1bC0uMy0xNC4xLTUuMiAxMy42LTMtMTQuNS0zIDE0LjUtNS4yLTEzLjZMMTQgMjUgNi41IDEzLjUgOSAyNnoiLz48cGF0aCBzdHJva2UtbGluZWNhcD0iYnV0dCIgZD0iTTkgMjZjMCAyIDEuNSAyIDIuNSA0IDEgMS41IDEgMSAuNSAzLjUtMS41IDEtMS41IDIuNS0xLjUgMi41LTEuNSAxLjUuNSAyLjUuNSAyLjUgNi41IDEgMTYuNSAxIDIzIDAgMCAwIDEuNS0xIDAtMi41IDAgMCAuNS0xLjUtMS0yLjUtLjUtMi41LS41LTIgLjUtMy41IDEtMiAyLjUtMiAyLjUtNC04LjUtMS41LTE4LjUtMS41LTI3IDB6Ii8+PHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiIGQ9Ik0xMSAzOC41YTM1IDM1IDEgMCAwIDIzIDAiLz48cGF0aCBmaWxsPSJub25lIiBzdHJva2U9IiNlY2VjZWMiIGQ9Ik0xMSAyOWEzNSAzNSAxIDAgMSAyMyAwbS0yMS41IDIuNWgyMG0tMjEgM2EzNSAzNSAxIDAgMCAyMiAwbS0yMyAzYTM1IDM1IDEgMCAwIDI0IDAiLz48L2c+PC9zdmc+",
    "bR": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSI+PGcgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSIxLjUiPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJidXR0IiBkPSJNOSAzOWgyN3YtM0g5djN6bTMuNS03IDEuNS0yLjVoMTdsMS41IDIuNWgtMjB6bS0uNSA0di00aDIxdjRIMTJ6Ii8+PHBhdGggc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiIGQ9Ik0xNCAyOS41di0xM2gxN3YxM0gxNHoiLz48cGF0aCBzdHJva2UtbGluZWNhcD0iYnV0dCIgZD0iTTE0IDE2LjUgMTEgMTRoMjNsLTMgMi41SDE0ek0xMSAxNFY5aDR2Mmg1VjloNXYyaDVWOWg0djVIMTF6Ii8+PHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZWNlY2VjIiBzdHJva2UtbGluZWpvaW49Im1pdGVyIiBzdHJva2Utd2lkdGg9IjEiIGQ9Ik0xMiAzNS41aDIxbS0yMC00aDE5bS0xOC0yaDE3bS0xNy0xM2gxN00xMSAxNGgyMyIvPjwvZz48L3N2Zz4=",
    "bB": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSIxLjUiPjxnIGZpbGw9IiMwMDAiIHN0cm9rZS1saW5lY2FwPSJidXR0Ij48cGF0aCBkPSJNOSAzNmMzLjQtMSAxMC4xLjQgMTMuNS0yIDMuNCAyLjQgMTAuMSAxIDEzLjUgMiAwIDAgMS42LjUgMyAyLS43IDEtMS42IDEtMyAuNS0zLjQtMS0xMC4xLjUtMTMuNS0xLTMuNCAxLjUtMTAuMSAwLTEzLjUgMS0xLjQuNS0yLjMuNS0zLS41IDEuNC0yIDMtMiAzLTJ6Ii8+PHBhdGggZD0iTTE1IDMyYzIuNSAyLjUgMTIuNSAyLjUgMTUgMCAuNS0xLjUgMC0yIDAtMiAwLTIuNS0yLjUtNC0yLjUtNCA1LjUtMS41IDYtMTEuNS01LTE1LjUtMTEgNC0xMC41IDE0LTUgMTUuNSAwIDAtMi41IDEuNS0yLjUgNCAwIDAtLjUuNSAwIDJ6Ii8+PHBhdGggZD0iTTI1IDhhMi41IDIuNSAwIDEgMS01IDAgMi41IDIuNSAwIDEgMSA1IDB6Ii8+PC9nPjxwYXRoIHN0cm9rZT0iI2VjZWNlYyIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIgZD0iTTE3LjUgMjZoMTBNMTUgMzBoMTVtLTcuNS0xNC41djVNMjAgMThoNSIvPjwvZz48L3N2Zz4=",
    "bN": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSIxLjUiPjxwYXRoIGZpbGw9IiMwMDAiIGQ9Ik0yMiAxMGMxMC41IDEgMTYuNSA4IDE2IDI5SDE1YzAtOSAxMC02LjUgOC0yMSIvPjxwYXRoIGZpbGw9IiMwMDAiIGQ9Ik0yNCAxOGMuMzggMi45MS01LjU1IDcuMzctOCA5LTMgMi0yLjgyIDQuMzQtNSA0LTEuMDQtLjk0IDEuNDEtMy4wNCAwLTMtMSAwIC4xOSAxLjIzLTEgMi0xIDAtNCAxLTQtNCAwLTIgNi0xMiA2LTEyczEuODktMS45IDItMy41Yy0uNzMtMS0uNS0yLS41LTMgMS0xIDMgMi41IDMgMi41aDJzLjc4LTIgMi41LTNjMSAwIDEgMyAxIDMiLz48cGF0aCBmaWxsPSIjZWNlY2VjIiBzdHJva2U9IiNlY2VjZWMiIGQ9Ik05LjUgMjUuNWEuNS41IDAgMSAxLTEgMCAuNS41IDAgMSAxIDEgMHptNS40My05Ljc1YS41IDEuNSAzMCAxIDEtLjg2LS41LjUgMS41IDMwIDEgMSAuODYuNXoiLz48cGF0aCBmaWxsPSIjZWNlY2VjIiBzdHJva2U9Im5vbmUiIGQ9Im0yNC41NSAxMC40LS40NSAxLjQ1LjUuMTVjMy4xNSAxIDUuNjUgMi40OSA3LjkgNi43NVMzNS43NSAyOS4wNiAzNS4yNSAzOWwtLjA1LjVoMi4yNWwuMDUtLjVjLjUtMTAuMDYtLjg4LTE2Ljg1LTMuMjUtMjEuMzQtMi4zNy00LjQ5LTUuNzktNi42NC05LjE5LTcuMTZsLS41MS0uMXoiLz48L2c+PC9zdmc+",
    "bP": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSI+PHBhdGggc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS13aWR0aD0iMS41IiBkPSJNMjIuNSA5YTQgNCAwIDAgMC0zLjIyIDYuMzggNi40OCA2LjQ4IDAgMCAwLS44NyAxMC42NWMtMyAxLjA2LTcuNDEgNS41NS03LjQxIDEzLjQ3aDIzYzAtNy45Mi00LjQxLTEyLjQxLTcuNDEtMTMuNDdhNi40NiA2LjQ2IDAgMCAwLS44Ny0xMC42NUE0LjAxIDQuMDEgMCAwIDAgMjIuNSA5eiIvPjwvc3ZnPg==",
};
function pieceKey(ch) {
    const c = ch === ch.toUpperCase() ? 'w' : 'b';
    return c + ch.toUpperCase();
}
function toast(msg, type, duration) {
    var cls = 'toast';
    if (type === true || type === 'error') cls += ' error';
    else if (type === 'warn') cls += ' warn';
    var ms = duration || (type === 'error' || type === true ? 5000 : 3000);
    var el = document.createElement('div');
    el.className = cls;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, ms);
}
function setButtonLoading(btn, loading = true) {
    if (!btn) return;
    if (loading) {
        btn.disabled = true;
        btn.dataset.originalText = btn.textContent;
        btn.innerHTML = '<span style="display:inline-block;animation:spin 1s linear infinite;width:16px;height:16px;border:2px solid var(--border);border-top:2px solid currentColor;border-radius:50%;vertical-align:middle"></span> ' + btn.textContent;
    } else {
        btn.disabled = false;
        if (btn.dataset.originalText) {
            btn.textContent = btn.dataset.originalText;
            delete btn.dataset.originalText;
        }
    }
}
function topBanner(msg, duration = 3000) {
    const banner = document.getElementById('notification-banner');
    if (!banner) return;
    banner.textContent = msg;
    banner.style.display = 'block';
    banner.style.background = 'var(--bg-secondary)';
    banner.style.color = 'var(--text)';
    banner.style.border = '1px solid var(--border)';
    if (duration > 0) {
        setTimeout(() => {
            banner.style.display = 'none';
        }, duration);
    }
}
let notificationTimeout = null;
function showProminentNotification(msg, type = 'info', minDuration = 3000) {
    const banner = document.getElementById('notification-banner');
    if (!banner) return;
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }
    
    banner.textContent = msg;
    banner.style.display = 'block';
    if (type === 'accept' || type === 'success') {
        banner.style.background = '#10b981';
        banner.style.color = 'white';
        banner.style.border = 'none';
    } else if (type === 'decline' || type === 'warning') {
        banner.style.background = '#f59e0b';
        banner.style.color = 'white';
        banner.style.border = 'none';
    } else {
        banner.style.background = 'var(--bg-secondary)';
        banner.style.color = 'var(--text)';
        banner.style.border = '1px solid var(--border)';
    }
    if (minDuration >= 3000) {
        banner.innerHTML = msg + ' <button onclick="hideProminentNotification()" style="margin-left:16px;padding:4px 8px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);border-radius:4px;color:inherit;cursor:pointer">Dismiss</button>';
    }
    if (minDuration > 0) {
        notificationTimeout = setTimeout(() => {
            banner.style.display = 'none';
            notificationTimeout = null;
        }, minDuration);
    }
}
function hideProminentNotification() {
    const banner = document.getElementById('notification-banner');
    if (banner) banner.style.display = 'none';
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }
}
function _activateView(viewId, navLabel) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById('view-' + viewId);
    if (el) el.classList.add('active');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    if (navLabel) {
        document.querySelectorAll('nav button').forEach(b => {
            if (b.textContent === navLabel) b.classList.add('active');
        });
    }
}
function _applyGameFilters(params) {
    const tags = Array.isArray(params.tags) ? params.tags.slice() : [];
    AppState.gameTagFilters = tags;
    AppState.gameCollectionFilter = params.collection_id ? params.collection_id : null;
    AppState.gameResultFilter = params.result || '';
    AppState.gameSearch = params.search || '';
    AppState.gamePage = params.page ? Math.max(0, parseInt(params.page, 10) || 0) : 0;
    const si = document.getElementById('game-search-input');
    if (si) si.value = AppState.gameSearch;
    const rf = document.getElementById('game-result-filter');
    if (rf) rf.value = AppState.gameResultFilter;
}
function _applyPositionFilters(params) {
    const tags = Array.isArray(params.tags) ? params.tags.slice() : [];
    AppState.positionTagFilters = tags;
}
function renderRoute(route) {
    EngineUI.unmount();
    AnnotationPanel.unmount();
    const params = (route && route.params) || {};
    switch (route.view) {
        case 'tactics':
        case 'tabiya':
        case 'endings':
        case 'strategy':
            _applyPositionFilters(params);
            var cat = CATEGORIES[route.view];
            AppState.currentCategory = route.view;
            _activateView('category', cat.label);
            // Set dynamic text content
            document.getElementById('cat-browse-title').textContent = cat.label;
            document.getElementById('cat-add-btn').textContent = '+ ' + cat.addLabel;
            document.getElementById('cat-add-btn').onclick = function() {
                Router.navigate({view:'addPosition', params:{type: cat.positionType}});
            };
            mountCategoryTagFilter(route.view);
            loadCategoryPositions(route.view).then(function() {
                var featuredId = params.featured ? parseInt(params.featured, 10) : null;
                if (featuredId && !isNaN(featuredId)) {
                    loadCategoryFeaturedById(featuredId);
                    Router.syncUrl({ view: route.view, params: {} });
                } else {
                    loadRandomCategoryFeatured();
                }
            });
            break;
        case 'positionDetail':
            _applyPositionFilters(params);
            var catKey = TYPE_TO_CATEGORY[route.positionType] || 'tabiya';
            var navLabel = CATEGORIES[catKey] ? CATEGORIES[catKey].label : 'Tabiya';
            _activateView('detail', navLabel);
            loadPositionDetail(route.id);
            break;
        case 'addPosition':
            _activateView('add', 'Add New');
            AppState.addPositionType = (route.params && route.params.type) || 'tabiya';
            // Find the matching category label for the form title
            var addCat = Object.values(CATEGORIES).find(c => c.positionType === AppState.addPositionType);
            document.getElementById('form-title').textContent = addCat ? addCat.addLabel : 'New Position';
            BoardManager.setPosition('board', AppState.boardFen);
            _initFormTagFilter();
            break;
        case 'games':
            _applyGameFilters(params);
            _activateView('games', 'Games');
            mountGameTagFilter();
            loadGames();
            loadCollections();
            break;
        case 'gameDetail':
            _activateView('game-viewer', 'Games');
            loadGameDetail(route.id);
            break;
        case 'gameImport':
            _activateView('import', 'Games');
            loadCollections().then(resetImportView);
            break;
        case 'collections':
            _activateView('collections', 'Collections');
            loadCollectionsView();
            break;
        case 'collectionDetail':
            // Collection detail = games list filtered by collection id
            AppState.gameCollectionFilter = String(route.id);
            _activateView('games', 'Games');
            mountGameTagFilter();
            loadGames();
            loadCollections();
            break;
        case 'search':
            _activateView('search', 'Search');
            loadCollections().then(renderSearchScope);
            initSearchBoard();
            break;
        case 'bulkAdd':
            _activateView('bulk-add', null);
            BulkAdd.init(params);
            break;
        case 'editor':
            _activateView('editor', null);
            BoardEditor.init(params);
            break;
        case 'practice':
            _activateView('practice', 'Practice');
            Practice.loadPracticeTab();
            break;
        case 'practiceGameDetail':
            _activateView('practice-viewer', 'Practice');
            PracticeViewer._load(route.id);
            break;
        default:
            _activateView('tactics', 'Tactics');
            mountTacticsTagFilter();
            loadTactics().then(function() { loadRandomFeatured(); });
    }
}
const _LEGACY_VIEWS = {
    positions: { view: 'positions' },
    add: { view: 'addPosition' },
    games: { view: 'games' },
    collections: { view: 'collections' },
    search: { view: 'search' },
    practice: { view: 'practice' },
    import: { view: 'gameImport' },
};
function showView(name) {
    const route = _LEGACY_VIEWS[name];
    if (route) {
        if (route.view === 'games' && AppState.gameCollectionFilter) {
            route.params = { collection_id: AppState.gameCollectionFilter };
        }
        Router.navigate(route);
        return;
    }
    const labels = { detail: 'Positions', 'game-viewer': 'Games' };
    _activateView(name, labels[name]);
}
async function saveBoardPosition(boardId, positionType) {
    var fen = BoardManager.getPosition(boardId);
    if (!fen) { toast('No position on board', true); return; }
    var title = 'Untitled';
    if (AppState.currentGame) {
        var g = AppState.currentGame, ply = AppState.currentPly;
        var moveDesc = ply === 0 ? 'starting position' : 'after ' + Math.ceil(ply / 2) + '.' + (ply % 2 === 1 ? '' : '...') + g.moves_san[ply - 1];
        title = (g.white || '?') + ' vs ' + (g.black || '?') + ' - ' + moveDesc;
    } else if (AppState.currentDetailId) {
        var el = document.getElementById('detail-title');
        title = 'From ' + (el ? el.textContent : 'position');
    }
    var res = await fetch(API + '/positions/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fen: fen, title: title, position_type: positionType })
    });
    var savedCat = Object.values(CATEGORIES).find(c => c.positionType === positionType);
    if (res.ok) toast('\u2713 Saved as ' + (savedCat ? savedCat.label.toLowerCase() : positionType));
    else {
        var err = await res.json();
        if (res.status === 409) toast('Position already saved', 'warn');
        else toast(err.detail || 'Error saving', 'error');
    }
}
window.API = API;
window.PIECE_SVG = PIECE_SVG;
window.pieceKey = pieceKey;
window.toast = toast;
window.showView = showView;
window.saveBoardPosition = saveBoardPosition;
window.addEventListener('beforeunload', function () { StockfishService.destroy(); });
function toggleNewMenu() {
    var menu = document.getElementById('new-dropdown-menu');
    if (menu) menu.style.display = menu.style.display === 'none' ? '' : 'none';
}
function closeNewMenu() {
    var menu = document.getElementById('new-dropdown-menu');
    if (menu) menu.style.display = 'none';
}
document.addEventListener('click', function(e) {
    if (!e.target.closest('#new-dropdown')) closeNewMenu();
});

window.toggleNewMenu = toggleNewMenu;
window.closeNewMenu = closeNewMenu;
window.renderRoute = renderRoute;
