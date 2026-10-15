"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { addChildAction } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={pending}>
      {pending ? "Adding…" : "Add child"}
    </button>
  );
}

/** A button that opens the “Add a child” pop-up. */
export function AddChild({ label = "+ Add a child", className = "btn btn-primary" }: { label?: string; className?: string }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const name = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");

  const open = () => {
    setError("");
    dlg.current?.showModal();
    name.current?.focus();
  };
  const close = () => dlg.current?.close();

  return (
    <>
      <button type="button" className={className} onClick={open}>
        {label}
      </button>
      <dialog
        ref={dlg}
        className="adddialog"
        aria-labelledby="add-title"
        onClick={(e) => {
          if (e.target === dlg.current) close();
        }}
        onClose={() => {
          formRef.current?.reset();
        }}
      >
        <form
          ref={formRef}
          action={addChildAction}
          onSubmit={(e) => {
            if (!name.current?.value.trim()) {
              e.preventDefault();
              setError("Please type the child’s name.");
              name.current?.focus();
            }
          }}
        >
          <header className="dlg-head">
            <div>
              <h2 id="add-title">Add a child</h2>
              <p className="muted small">A first name is enough. You’ll answer their questions straight after.</p>
            </div>
            <button type="button" className="dlg-x" onClick={close} aria-label="Close">
              ×
            </button>
          </header>
          <label className="field">
            <span>First name</span>
            <input ref={name} className="input" name="name" placeholder="e.g. Mia" autoComplete="off" maxLength={80} aria-invalid={error ? true : undefined} onChange={() => setError("")} />
            {error && <p className="error" role="alert">{error}</p>}
          </label>
          <fieldset className="field">
            <legend>
              Pronouns <small>(used when writing the report)</small>
            </legend>
            <div className="seg">
              {[
                ["she", "she / her"],
                ["he", "he / him"],
                ["they", "they / them"],
              ].map(([v, l], i) => (
                <label key={v}>
                  <input type="radio" name="pronoun" value={v} defaultChecked={i === 0} />
                  <span>{l}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field">
            <span>
              Birthday <small>(optional — shows their age on the report)</small>
            </span>
            <input className="input" type="date" name="dob" />
          </label>
          <div className="dlg-actions">
            <button type="button" className="btn btn-quiet" onClick={close}>
              Cancel
            </button>
            <Submit />
          </div>
        </form>
      </dialog>
    </>
  );
}
