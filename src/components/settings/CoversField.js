import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { getSettingsCovers } from 'selectors';
import { setSettings } from 'actions';
import { defer } from 'helpers';

function CoversField() {
  const covers = useSelector(getSettingsCovers);
  const dispatch = useDispatch();

  const onChange = useCallback((event) => {
    defer(dispatch, setSettings({ covers: event.target.checked }));
  }, []);

  return (
    <div className="field">
      <label className="label has-text-light">Data saver</label>
      <div className="control">
        <div className="field">
          <input
            className="is-checkradio has-background-color is-white"
            id="covers"
            type="checkbox"
            name="covers"
            defaultChecked={covers}
            onChange={onChange}
          />
          <label htmlFor="covers" className="has-text-weight-semibold">
            Display album covers
          </label>
        </div>
      </div>
    </div>
  );
}

export default CoversField;
