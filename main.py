from fastapi import FastAPI, Path, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, computed_field
from typing import Annotated, Literal, Optional
from fastapi.staticfiles import StaticFiles
import json
import os

# --- FastAPI App Initialization ---
app = FastAPI()

# --- Pydantic Models for Data Validation ---
# data validation using pydantic
class Patient(BaseModel):
    id: Annotated[str, Field(..., description='ID of the Patient', example='P001')]
    name: Annotated[str, Field(..., description='Name of the Patient')]
    city: Annotated[str, Field(..., description='City where the Patient is living')]
    age: Annotated[int, Field(..., gt=0, lt=120, description='Age of the Patient')]
    gender: Annotated[Literal['male', 'female', 'others'], Field(..., description='Gender of the patient')]
    height: Annotated[float, Field(..., gt=0, description='Height of the Patient in meters')]
    weight: Annotated[float, Field(..., gt=0, description='Weight of the Patient in kgs')]

    @computed_field
    @property
    def bmi(self) -> float:
        # This check prevents a ZeroDivisionError if height is 0
        if self.height > 0:
            bmi = round(self.weight / (self.height**2), 2)
            return bmi
        return 0

    @computed_field
    @property
    def verdict(self) -> str:
        # Use the computed bmi property directly
        if self.bmi < 18.5:
            return "Underweight"
        elif self.bmi < 25:
            return 'Normal'
        elif self.bmi < 30:
            return 'Overweight'
        else:
            return 'Obesity'

class PatientUpdate(BaseModel):
    name: Annotated[Optional[str], Field(default=None, description='Name of the Patient')]
    city: Annotated[Optional[str], Field(default=None, description='City where the Patient is living')]
    age: Annotated[Optional[int], Field(default=None, gt=0, lt=120, description='Age of the Patient')]
    gender: Annotated[Optional[Literal['male', 'female', 'others']], Field(default=None, description='Gender of the patient')]
    height: Annotated[Optional[float], Field(default=None, gt=0, description='Height of the Patient in meters')]
    weight: Annotated[Optional[float], Field(default=None, gt=0, description='Weight of the Patient in kgs')]

# --- Helper Functions for Data Handling ---

# let's create a function which will load the data from the json file
def load_data():
    # This try-except block prevents the app from crashing if 'patients.json' doesn't exist or is empty
    try:
        with open('patients.json', 'r') as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        data = {}
    return data

def save_data(data):
    # Using 'indent=2' makes the JSON file readable for humans
    with open('patients.json', 'w') as f:
        json.dump(data, f, indent=2)

# --- API Endpoints ---
# NOTE: All API endpoints must be defined BEFORE mounting the static files directory.

# This endpoint is now handled by app.mount, which serves index.html.
# The original function below would never be called.
# @app.get("/")
# def home():
#     return {"message": "App is working!"}

@app.get('/about')
def about():
    return {'message': 'Fully Functional API to Manage your Patient records'}

@app.get('/view')
def view():
    return load_data()

@app.get('/patient/{patient_id}')
def view_patient(patient_id: str = Path(..., description="ID of the patient in DB", example='P001')):  # our id is string because in patients.json file id is string
    # first we will load the patient data
    data = load_data()
    if patient_id in data:
        return data[patient_id]
    # return {'ERROR' : 'patient is not found...'}
    # this is not the right way because what we are doing is simply return json content with 200 HTTP state code
    # we need to show 404 code if data not found that's why we'll use HTTPException
    raise HTTPException(status_code=404, detail='Patient not Found')

@app.get('/sort')
def sort_patient(sort_by: str = Query(..., description='Sort on the basis of height, weight or bmi'), order: str = Query('asc', description='sort in asc or desc order...')):
    valid_field = ['height', 'weight', 'bmi']
    if sort_by not in valid_field:
        raise HTTPException(status_code=400, detail=f'Invalid field, select from {valid_field}')
    if order not in ['asc', 'desc']:
        raise HTTPException(status_code=400, detail='Invalid order, select between asc and desc')

    data = load_data()
    # Convert the dictionary of patients into a list for sorting
    patients_list = list(data.values())
    sort_order = True if order == 'desc' else False
    
    # *** FIX: Use the 'sort_by' variable in the key, not the literal string 'sort_by'. ***
    sorted_data = sorted(patients_list, key=lambda x: x.get(sort_by, 0), reverse=sort_order)
    return sorted_data

@app.post('/create')
def create_patient(patient: Patient):  # patient data will validate from the Patient Pydantic model we don't need to worry about the validation
    # load exiting data
    data = load_data()
    # checking if the patient already exists
    if patient.id in data:
        raise HTTPException(status_code=400, detail='Patient already exists')

    # new patient add to the database
    # first we will convert this patient which is a pydantic form into dict
    # model_dump() is used to convert the Pydantic model to a dictionary.
    # It correctly includes the computed fields (bmi, verdict).
    data[patient.id] = patient.model_dump(exclude={'id'})
    # finally save it
    save_data(data)
    return JSONResponse(status_code=201, content={'message': 'patient created successfully'})

@app.put('/edit/{patient_id}')
def update_patient(patient_id: str, patient_update: PatientUpdate):
    data = load_data()
    # first we'll check this patient_id exists in my data base or not
    if patient_id not in data:
        raise HTTPException(status_code=404, detail="Patient not found")

    existing_patient_info = data[patient_id]  # this is the existing dictionary which we have
    # now we have dict and we need to update the data which is given
    # now we have patient_update data we need to convert it into dictionary
    update_patient_info = patient_update.model_dump(exclude_unset=True)
    # we did this: exclude_unset
    # because if we didn't do that then dictionary will have all the fields that we created
    # but after this we only have those which user want to update

    # This loop updates the existing patient's data with the new data provided.
    for key, value in update_patient_info.items():
        existing_patient_info[key] = value

    # data[patient_id] = existing_patient_info
    # we can't do directly this because if we change weight then other two parameters also change, that's why we need a mechanism which also update those
    # existing_patient_info --> pydantic object --> updated bmi + verdict --> pydantic object -> dict

    # but this will give error
    # because in existing_patient_info dict we don't have id parameters that's why we need to add this id parameter first
    existing_patient_info['id'] = patient_id
    
    # By creating a new Patient object, Pydantic re-runs the validation and recalculates the computed fields (bmi, verdict).
    patient_pydantic_obj = Patient(**existing_patient_info)
    
    # now we don't need the id when we get dict we get id but that we don't want
    # Convert the fully updated Pydantic object back to a dictionary to be stored in our JSON file.
    existing_patient_info = patient_pydantic_obj.model_dump(exclude={'id'})
    
    # add this dict to data
    data[patient_id] = existing_patient_info
    # save
    save_data(data)
    return JSONResponse(status_code=200, content={'message': 'patient updated successfully'})

@app.delete('/delete/{patient_id}')  # here we will get a patient_id
def delete_patient(patient_id: str):
    # load data
    data = load_data()
    if patient_id not in data:
        raise HTTPException(status_code=404, detail='patient data is not found')
    
    del data[patient_id]
    save_data(data)
    return JSONResponse(status_code=200, content={'message': 'patient deleted successfully'})


# --- Static Files Mount (MUST BE LAST) ---
# This line tells FastAPI to serve the frontend files. It must come AFTER all the API routes above.
# This uses a relative path, making your project portable and work on any computer.
frontend_path = os.path.join(os.path.dirname(__file__), "frontend")
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="static")
