/*
 * Wire
 * Copyright (C) 2018 Wire Swiss GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 *
 */

import {clamp} from 'Util/NumberUtil';
import {noop} from 'Util/util';
import {KEY, isEnterKey} from 'Util/KeyboardUtil';

import {ParticipantAvatar} from 'Components/participantAvatar';

class MentionSuggestions {
  constructor(params) {
    this.onInput = this.onInput.bind(this);
    this.onSuggestionClick = this.onSuggestionClick.bind(this);
    this.onInitSimpleBar = this.onInitSimpleBar.bind(this);
    this.onMouseEnter = this.onMouseEnter.bind(this);

    this.isVisible = ko.observable(false);
    this.onSelectionValidated = params.onSelectionValidated || noop;
    this.onEnd = params.onEnd || noop;
    this.suggestions = params.suggestions;
    this.targetInputSelector = params.targetInputSelector;
    this.targetInput = undefined;
    this.ParticipantAvatar = ParticipantAvatar;

    this.position = ko.observable({});

    this.selectedSuggestionIndex = ko.observable(0);
    this.selectedSuggestionIndexSubscription = this.selectedSuggestionIndex.subscribe(this.updateScrollPosition);
    this.selectedSuggestion = ko.pureComputed(() => this.suggestions()[this.selectedSuggestionIndex()]);

    this.suggestionSubscription = this.suggestions.subscribe(suggestions => {
      const shouldBeVisible = suggestions.length > 0;
      if (shouldBeVisible && !this.isVisible()) {
        this.initList();
        this.updatePosition();
      } else if (!shouldBeVisible && this.isVisible()) {
        this.teardownList();
      } else if (this.isVisible()) {
        this.updateSelectedIndexBoundaries(suggestions);
        this.updatePosition();
      }
      this.isVisible(shouldBeVisible);
      this.updateScrollPosition(this.selectedSuggestionIndex());
    });

    this.shouldUpdateScrollbar = ko.pureComputed(this.suggestions).extend({notify: 'always', rateLimit: 100});
  }

  setWrapperSize(size = '') {
    const wrapper = document.querySelector('.conversation-input-bar-mention-suggestion');
    if (wrapper) {
      wrapper.style.width = size;
    }
  }

  onInitSimpleBar(simpleBar) {
    this.scrollElement = simpleBar.getScrollElement();
  }

  onInput(keyboardEvent) {
    const actions = {
      [KEY.ARROW_UP]: this.moveSelection.bind(this, 1),
      [KEY.ARROW_DOWN]: this.moveSelection.bind(this, -1),
      [KEY.ENTER]: this.validateSelection.bind(this, keyboardEvent),
      [KEY.TAB]: this.validateSelection.bind(this, keyboardEvent),
    };

    const action = actions[keyboardEvent.key];
    if (action) {
      const wasHandled = action();
      if (wasHandled) {
        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
      }
    }
  }

  onMouseEnter(user) {
    this.selectedSuggestionIndex(this.suggestions().indexOf(user));
  }

  moveSelection(delta) {
    const currentIndex = this.selectedSuggestionIndex();
    const newIndex = clamp(currentIndex + delta, 0, this.suggestions().length - 1);
    this.selectedSuggestionIndex(newIndex);
    return true;
  }

  onSuggestionClick(data, event) {
    event.preventDefault();
    $(this.targetInput).focus();
    this.onSelectionValidated(data, this.targetInput);
  }

  validateSelection(keyboardEvent) {
    const isShiftEnter = isEnterKey(keyboardEvent) && keyboardEvent.shiftKey;
    if (isShiftEnter) {
      return false;
    }

    this.onSelectionValidated(this.selectedSuggestion(), this.targetInput);
    return true;
  }

  updateScrollPosition(selectedNumber) {
    if (!this.scrollElement) {
      return;
    }
    const listItems = this.scrollElement.querySelectorAll('.mention-suggestion-list__item');
    const selectedItem = listItems[listItems.length - 1 - selectedNumber];
    if (!selectedItem) {
      return;
    }
    const scrollRect = this.scrollElement.getBoundingClientRect();
    const itemRect = selectedItem.getBoundingClientRect();
    const topDiff = scrollRect.top - itemRect.top;
    if (topDiff > 0) {
      return (this.scrollElement.scrollTop -= topDiff + 4);
    }
    const bottomDiff = itemRect.bottom - scrollRect.bottom + 20;
    if (bottomDiff > 0) {
      return (this.scrollElement.scrollTop += bottomDiff + 4);
    }
  }

  initList() {
    this.targetInput = this.initTargetInput();
    this.selectedSuggestionIndex(0);
  }

  updatePosition() {
    const inputBoundingRect = this.targetInput.getBoundingClientRect();
    const bottom = window.innerHeight - inputBoundingRect.top + 24;

    this.position({bottom: `${bottom}px`});
  }

  updateSelectedIndexBoundaries(suggestions) {
    const currentIndex = this.selectedSuggestionIndex();
    this.selectedSuggestionIndex(clamp(currentIndex, 0, suggestions.length - 1));
  }

  teardownList() {
    this.targetInput.removeEventListener('keydown', this.onInput, true);
  }

  initTargetInput() {
    const input = this.targetInput || document.querySelector(this.targetInputSelector);
    input.addEventListener('keydown', this.onInput, true);
    this.targetInput = input;
    return input;
  }

  dispose() {
    this.suggestionSubscription.dispose();
    this.selectedSuggestionIndexSubscription.dispose();
  }
}

ko.components.register('mention-suggestions', {
  template: `
  <!-- ko if: isVisible() -->
    <div class="conversation-input-bar-mention-suggestion" data-uie-name="list-mention-suggestions" data-bind="style: position(), simplebar: {trigger: shouldUpdateScrollbar, onInit: onInitSimpleBar}">
      <div class="mention-suggestion-list" data-bind="foreach: {data: suggestions().slice().reverse(), as: 'suggestion', noChildContext: true}">
        <div class="mention-suggestion-list__item" data-bind="
          click: (data, event) => onSuggestionClick(suggestion, event),
          event: { mouseenter: onMouseEnter},
          css: {'mention-suggestion-list__item--highlighted': suggestion === selectedSuggestion()},
          attr: {'data-uie-value': suggestion.id, 'data-uie-selected': suggestion === selectedSuggestion()}" data-uie-name="item-mention-suggestion">
          <participant-avatar params="participant: suggestion, size: ParticipantAvatar.SIZE.XXX_SMALL"></participant-avatar>
          <div class="mention-suggestion-list__item__name" data-bind="text: suggestion.name()" data-uie-name="status-name"></div>
          <!-- ko if: suggestion.isTemporaryGuest() -->
            <div class="mention-suggestion-list__item__remaining"  data-bind="text: suggestion.expirationRemainingText()" data-uie-name="status-remaining"></div>
          <!-- /ko -->
          <!-- ko ifnot: suggestion.isTemporaryGuest() -->
            <div class="mention-suggestion-list__item__username" data-bind="text: suggestion.username()" data-uie-name="status-username"></div>
          <!-- /ko -->
          <!-- ko if: suggestion.isGuest() -->
            <guest-icon class="mention-suggestion-list__item__guest-badge" data-uie-name="status-guest"></guest-icon>
          <!-- /ko -->
        </div>
      </div>
    </div>
  <!-- /ko -->`,

  viewModel: MentionSuggestions,
});
