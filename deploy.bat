@echo off
SET choice=%1

IF "%choice%"=="dev" (
    echo Using DEV rules...
    copy firestore.dev.rules firestore.rules /Y
    firebase deploy --only firestore
) ELSE IF "%choice%"=="prod" (
    echo Using PROD rules...
    copy firestore.prod.rules firestore.rules /Y
    firebase deploy --only firestore
) ELSE (
    echo Usage:
    echo   deploy dev   - deploy dev rules
    echo   deploy prod  - deploy prod rules
)
