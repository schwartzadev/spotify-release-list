import React, { useState } from 'react';
import classNames from 'classnames';
import { useFormContext } from 'react-hook-form';
import { FieldName } from 'enums';
import { toggleSetValue, defer } from 'helpers';
import AlbumFullTitle from './AlbumFullTitle';

function SelectionField() {
  const { setValue, watch, errors } = useFormContext();
  const [expanded, setExpanded] = useState(false);
  const releases = watch(FieldName.RELEASES);
  const selectedReleases = watch(FieldName.SELECTED_RELEASES);

  const releaseChangeHandler = (event) => {
    defer(
      setValue,
      FieldName.SELECTED_RELEASES,
      toggleSetValue(selectedReleases, event.target.value),
      true
    );
  };

  if (!releases || !selectedReleases || releases.length === 0) {
    return null;
  }

  return (
    <div className="SelectionField field">
      <button
        type="button"
        className="button is-dark is-rounded is-fullwidth has-text-weight-semibold"
        onClick={() => defer(setExpanded, (currentExpanded) => !currentExpanded)}
      >
        <span>
          {expanded ? 'Collapse' : 'Expand'} selection ({selectedReleases.size})
        </span>
        <span className="icon" key={expanded}>
          <i
            className={classNames('fas', {
              'fa-caret-up': expanded,
              'fa-caret-down': !expanded,
            })}
          ></i>
        </span>
      </button>

      <div
        className={classNames('selection', {
          'is-hidden': !expanded,
        })}
      >
        <button
          type="button"
          className="button is-rounded is-small is-dark is-darker"
          onClick={() => defer(setValue, FieldName.SELECTED_RELEASES, new Set(releases), true)}
        >
          <span>Select all</span>
        </button>
        <button
          type="button"
          className="button is-rounded is-small is-dark is-darker"
          onClick={() => defer(setValue, FieldName.SELECTED_RELEASES, new Set([]), true)}
        >
          <span>Unselect all</span>
        </button>

        {releases.map((releaseId) => (
          <div className="field" key={releaseId}>
            <input
              type="checkbox"
              className={classNames('is-checkradio is-small is-white', {
                'has-background-color': selectedReleases.has(releaseId),
              })}
              id={`selectedReleases[${releaseId}]`}
              name={`selectedReleases[${releaseId}]`}
              value={releaseId}
              checked={selectedReleases.has(releaseId)}
              onChange={releaseChangeHandler}
            />
            <label
              htmlFor={`selectedReleases[${releaseId}]`}
              className={classNames('is-unselectable', {
                'has-text-grey': !selectedReleases.has(releaseId),
              })}
            >
              <AlbumFullTitle id={releaseId} />
            </label>
          </div>
        ))}
      </div>

      {errors[FieldName.SELECTED_RELEASES] && (
        <p className="help is-danger">No releases selected.</p>
      )}
    </div>
  );
}

export default SelectionField;
