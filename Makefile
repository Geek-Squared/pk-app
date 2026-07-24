# Positive Konnections — mobile build & release
#
# Web build (Angular) -> Capacitor sync -> Android AAB -> Play Store (fastlane).
# Run `make help` to list targets.

# Path to the Play service-account JSON, relative to the android/ dir.
SUPPLY_JSON_KEY ?= fastlane/keys/play.json
export SUPPLY_JSON_KEY

.DEFAULT_GOAL := help

## ----------------------------------------------------------------------------
## Setup
## ----------------------------------------------------------------------------

install: ## Install JS dependencies (clean install)
	npm ci

## ----------------------------------------------------------------------------
## Web build
## ----------------------------------------------------------------------------

build: ## Production Angular build -> www/
	npm run build

## ----------------------------------------------------------------------------
## Android
## ----------------------------------------------------------------------------

sync: ## Copy web build + plugins into the android project
	npx cap sync android

android: build sync ## Full web build + sync into android (no upload)

open: ## Open the android project in Android Studio
	npx cap open android

aab: android ## Build a signed release .aab locally (no upload)
	cd android && ./gradlew clean bundleRelease
	@echo "AAB: android/app/build/outputs/bundle/release/app-release.aab"

apk: android ## Build a signed release .apk locally (no upload)
	cd android && ./gradlew clean assembleRelease
	@echo "APK: android/app/build/outputs/apk/release/app-release.apk"

## ----------------------------------------------------------------------------
## Play Store (fastlane)
## ----------------------------------------------------------------------------

bump: ## Bump versionCode from the latest on the Play internal track
	cd android && fastlane bump_version_code_from_play track:internal

deploy-internal: android ## Bump, build AAB and upload a DRAFT to Play internal testing
	cd android && fastlane internal

## ----------------------------------------------------------------------------
## Housekeeping
## ----------------------------------------------------------------------------

clean: ## Remove web + android build artifacts
	rm -rf www dist
	cd android && ./gradlew clean

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

.PHONY: install build sync android open aab apk bump deploy-internal clean help
