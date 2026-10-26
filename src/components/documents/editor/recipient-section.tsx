"use client";

import { PatientCombobox } from "@/components/patients/patient-combobox";
import { PrescriberCombobox } from "@/components/prescribers/prescriber-combobox";
import { getPrescriberViewAction } from "@/server/actions/prescribers";
import { docFr } from "@/lib/i18n/documents";
import { useEditor } from "./editor-context";
import { FieldLabelRow } from "./section";

/** Choix du patient et du prescripteur (le prescripteur habituel est proposé automatiquement). */
export function RecipientFields() {
  const ed = useEditor();
  const { shared } = ed;
  return (
    <div className="grid gap-4 md:grid-cols-2 [&>div]:min-w-0">
      <div>
        <FieldLabelRow htmlFor="patient" label={docFr.fields.patient} required error={ed.errors.patientId ?? ed.errors.patientBirthDate} />
        <PatientCombobox
          id="patient"
          value={ed.patient}
          disabled={ed.readOnly}
          invalid={Boolean(ed.errors.patientId || ed.errors.patientBirthDate)}
          centres={shared.centres}
          activeCentreId={shared.activeCentreId}
          salutations={shared.salutations}
          onChange={async (p) => {
            ed.setPatient(p);
            if (p?.usualPrescriberId && !ed.prescriber) {
              const pr = await getPrescriberViewAction(p.usualPrescriberId);
              if (pr) ed.setPrescriber(pr);
            }
          }}
        />
      </div>
      <div>
        <FieldLabelRow htmlFor="prescriber" label={docFr.fields.prescriber} required error={ed.errors.prescriberId} />
        <PrescriberCombobox
          id="prescriber"
          value={ed.prescriber}
          disabled={ed.readOnly}
          invalid={Boolean(ed.errors.prescriberId)}
          onChange={ed.setPrescriber}
          centres={shared.centres}
          salutations={shared.salutations}
          canCreate={shared.canEditDirectory}
        />
      </div>
    </div>
  );
}
