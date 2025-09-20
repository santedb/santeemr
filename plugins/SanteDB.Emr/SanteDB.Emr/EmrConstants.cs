using System;
using System.Collections.Generic;
using System.Text;

namespace SanteEMR
{
    /// <summary>
    /// Constants used by the EMR plugin
    /// </summary>
    public static class EmrConstants
    {

        /// <summary>
        /// Status observations - patients may only have one of these 
        /// </summary>
        public static readonly Guid PatientStatusObservation = Guid.Parse("b73e6dbc-890a-11f0-8959-c764088c39f9");


        /// <summary>
        /// Concept set which indicates the patient has a status of note / special notes
        /// </summary>
        public static readonly Guid PatientIndicatorNegatedObservation = Guid.Parse("8e848f0e-890b-11f0-ae3f-9f37087e0822");

        /// <summary>
        /// Patient has an active condition
        /// </summary>
        public const string PatientHasConditionsTagKey = "$hasConditions";

        /// <summary>
        /// When a type of observation is registered here - the EMR will check if the value indicates the patient has the condition and will create a condition entry
        /// </summary>
        public static readonly Guid EmrConditionTrigger = Guid.Parse("2b3e26bc-5766-4e84-afac-a522edc2e7e3");

    }
}
