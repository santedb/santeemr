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
        /// True if the EMR plugin has already processed the data
        /// </summary>
        public const string IgnoreEmrTriggersTagName = "emr.processed";

        /// <summary>
        /// When a type of observation is registered here - the EMR will check if the value indicates the patient has the condition and will create a condition entry
        /// </summary>
        public static readonly Guid EmrConditionTrigger = Guid.Parse("2b3e26bc-5766-4e84-afac-a522edc2e7e3");

        /// <summary>
        /// Date of death concept key
        /// </summary>
        public static readonly Guid DateOfDeathConceptKey = Guid.Parse("51140974-adbe-4e56-bb38-66719f7945c9");

        /// <summary>
        /// Patient discharged because they died
        /// </summary>
        public static readonly Guid DischargeDispositionDied = Guid.Parse("6df3720b-857f-4ba2-826f-b7f1d3c3adbb");

        /// <summary>
        /// Birth registration
        /// </summary>
        public static readonly Guid RegistrationTypeBirth = Guid.Parse("f562e322-17ca-11eb-adc1-0242ac120002");

        /// <summary>
        /// The labour and delivery visit key
        /// </summary>
        public static readonly Guid LabourAndDeliveryVisitKey = Guid.Parse("f8932034-43d5-477d-9748-1609099314df");


        /// <summary>
        /// Clinical status of the condition
        /// </summary>
        public static readonly Guid ConditionClinicalStatusKey = Guid.Parse("656251ec-21bc-4594-9914-ca971c9defcc");

        /// <summary>
        /// Date of the condition resolution
        /// </summary>
        public static readonly Guid ConditionResolutionDateKey = Guid.Parse("aaf71c41-cca3-4a39-9dc9-3f685fc34c4d");

    }
}
