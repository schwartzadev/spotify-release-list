import React from 'react';
import classNames from 'classnames';
import { useFormContext } from 'react-hook-form';

function NameField() {
  const { register, errors } = useFormContext();

  return (
    <div className="field">
      <label className="label has-text-light">Name</label>
      <div className="control">
        <input
          name="name"
          className={classNames('input is-rounded', { 'is-danger': errors.name })}
          type="text"
          ref={register({ required: true, maxLength: 100 })}
        />
      </div>
      {errors.name && (
        <p className="help is-danger">
          {errors.name.type === 'required' && 'Name is required.'}
          {errors.name.type === 'maxLength' && "Name can't exceed 100 characters."}
        </p>
      )}
    </div>
  );
}

export default NameField;
