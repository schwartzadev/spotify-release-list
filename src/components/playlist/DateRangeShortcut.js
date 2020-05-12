import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { useFormContext } from 'react-hook-form';
import { min, max } from 'moment';
import { getReleasesMinMaxDatesMoment, getDayReleasesMap } from '../../selectors';
import { FieldName } from '../../enums';
import { getPlaylistNameSuggestion, getReleasesByDate } from '../../helpers';

function useClickHandler(start, end) {
  const releases = useSelector(getDayReleasesMap);
  const [minDate, maxDate] = useSelector(getReleasesMinMaxDatesMoment);
  const { setValue, triggerValidation, getValues } = useFormContext();

  return useCallback(
    (event) => {
      event.preventDefault();

      const values = getValues();
      const startDate = max(start, minDate);
      const endDate = min(end, maxDate);
      const filteredReleases = getReleasesByDate(releases, startDate, endDate);

      setValue(FieldName.START_DATE, startDate);
      setValue(FieldName.END_DATE, endDate);
      setValue(FieldName.RELEASES, filteredReleases);
      setValue(FieldName.SELECTED_RELEASES, new Set(filteredReleases));

      triggerValidation([
        FieldName.START_DATE,
        FieldName.END_DATE,
        FieldName.RELEASES,
        FieldName.SELECTED_RELEASES,
      ]);

      if (!values[FieldName.NAME_CUSTOM]) {
        setValue(FieldName.NAME, getPlaylistNameSuggestion(startDate, endDate));
        triggerValidation(FieldName.NAME);
      }
    },
    [start, end, minDate, maxDate, releases]
  );
}

function useButtonTitle(title, start, end) {
  return useMemo(() => (title instanceof Function ? title(start, end) : title), [
    title,
    start,
    end,
  ]);
}

function DateRangeShortcut({ title, start, end }) {
  const [minDate, maxDate] = useSelector(getReleasesMinMaxDatesMoment);
  const clickHandler = useClickHandler(start, end);
  const buttonTitle = useButtonTitle(title, start, end);

  if (start.isAfter(maxDate) || end.isBefore(minDate)) {
    return null;
  }

  return (
    <button
      className="DateRangeShortcut button is-dark is-darker is-rounded is-small has-text-weight-semibold"
      onClick={clickHandler}
      key={buttonTitle}
    >
      <span>{buttonTitle}</span>
    </button>
  );
}

DateRangeShortcut.propTypes = {
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.func]).isRequired,
  start: PropTypes.object.isRequired,
  end: PropTypes.object.isRequired,
};

export default DateRangeShortcut;
