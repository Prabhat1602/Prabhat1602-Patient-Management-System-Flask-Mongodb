from flask import Flask, request, jsonify, render_template, redirect, url_for
from pymongo import MongoClient
from bson.objectid import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta

# JWT imports
from flask_jwt_extended import create_access_token, JWTManager, jwt_required, get_jwt_identity, get_jwt

# Custom decorator for role-based access control
from functools import wraps

app = Flask(__name__)

# --- Configuration ---
app.config["MONGO_URI"] = "mongodb://localhost:27017/healthcare_system"
app.config["JWT_SECRET_KEY"] = "super-secret-jwt-key-you-should-change-in-production" # Change this!
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1) # Token valid for 1 hour

jwt = JWTManager(app)

# MongoDB Connection
client = MongoClient(app.config["MONGO_URI"])
db = client.healthcare_system
users = db.users
patients = db.patients

# --- JWT Callbacks (for revoked tokens and custom claims) ---
@jwt.user_lookup_loader # CORRECTED: Use user_lookup_loader for Flask-JWT-Extended v4.0.0+
def user_lookup_callback(_jwt_header, jwt_data):
    identity = jwt_data["sub"]
    return users.find_one({"username": identity})

@jwt.user_lookup_error_loader
def user_lookup_error_callback(_jwt_header, jwt_data):
    return jsonify({"msg": "User not found"}), 401

@jwt.additional_claims_loader
def add_claims_to_access_token(identity):
    user = users.find_one({"username": identity})
    if user:
        return {"roles": user.get("roles", [])}
    return {"roles": []}

# --- Custom Decorators ---
def role_required(required_roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            claims = get_jwt()
            user_roles = claims.get('roles', [])
            if not any(role in user_roles for role in required_roles):
                return jsonify({"msg": "Permission denied: Insufficient role"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator

# --- Routes ---

@app.route("/")
def index():
    return render_template("login.html")

@app.route("/dashboard")
# Removed @jwt_required() from here to allow dashboard.html to load,
# as JWT is handled by dashboard.js for API calls.
def dashboard():
    return render_template("dashboard.html")

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    roles = data.get("roles", ["nurse"]) # Default role is nurse if not specified

    if not username or not password:
        return jsonify({"msg": "Username and password are required"}), 400

    if users.find_one({"username": username}):
        return jsonify({"msg": "User already exists"}), 409

    hashed_password = generate_password_hash(password)
    users.insert_one({"username": username, "password": hashed_password, "roles": roles})
    return jsonify({"msg": "User registered successfully"}), 201

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"msg": "Username and password are required"}), 400

    user = users.find_one({"username": username})
    if user and check_password_hash(user["password"], password):
        access_token = create_access_token(identity=username)
        return jsonify(access_token=access_token), 200
    else:
        return jsonify({"msg": "Bad username or password"}), 401

# --- Patient Management API ---

# Get all patients
@app.route("/patients", methods=["GET"])
@jwt_required()
@role_required(["doctor", "nurse", "admin"])
def get_patients():
    patient_list = []
    # No search parameters here; this fetches ALL patients.
    # Filtering will be done client-side by dashboard.js for the search bar.
    for patient in patients.find():
        # Convert ObjectId to string for JSON serialization
        patient['_id'] = str(patient['_id'])
        patient_list.append(patient)
    return jsonify(patient_list)

# Get a single patient by MongoDB _id
@app.route("/patients/<string:patient_id>", methods=["GET"])
@jwt_required()
@role_required(["doctor", "nurse", "admin"])
def get_patient(patient_id):
    try:
        patient = patients.find_one({"_id": ObjectId(patient_id)})
        if patient:
            patient['_id'] = str(patient['_id']) # Convert ObjectId to string
            return jsonify(patient)
        return jsonify({"msg": "Patient not found"}), 404
    except Exception as e:
        # Handle cases where patient_id is not a valid ObjectId string
        return jsonify({"msg": f"Invalid patient ID format: {e}"}), 400


# Add a new patient
@app.route("/patients", methods=["POST"])
@jwt_required()
@role_required(["doctor", "nurse", "admin"])
def add_patient():
    data = request.get_json()
    
    # --- Robust Patient ID Generation ---
    # This aggregation pipeline finds the highest numeric part from existing patient_ids
    # that start with 'P', ensuring sequential IDs even if there are gaps or non-P IDs.
    pipeline = [
        {"$project": {
            "num_id": {
                "$cond": {
                    "if": {"$regexMatch": {"input": "$patient_id", "regex": "^P\\d+$"}},
                    "then": {"$toInt": {"$substr": ["$patient_id", 1, -1]}},
                    "else": 0 # Treat non-matching IDs as 0 for max calculation
                }
            }
        }},
        {"$group": {"_id": None, "max_num_id": {"$max": "$num_id"}}}
    ]
    result = list(patients.aggregate(pipeline))
    
    # Determine the next ID number
    if result and result[0]["max_num_id"] is not None:
        last_id_num = result[0]["max_num_id"]
        new_id_num = last_id_num + 1
    else:
        new_id_num = 1 # Start from 1 if no valid P-prefixed IDs are found

    # Format the new patient ID (e.g., P001, P002, P010)
    patient_id_counter = f"P{new_id_num:03d}"

    new_patient = {
        "patient_id": patient_id_counter, # Assign generated ID
        "name": data.get("name"),
        "age": data.get("age"),
        "gender": data.get("gender"),
        "department": data.get("department"),
        "contact_info": {
            "phone": data.get("contact_info", {}).get("phone"),
            "email": data.get("contact_info", {}).get("email")
        },
        "current_prescriptions": data.get("current_prescriptions", []),
        "medical_history": data.get("medical_history", []),
        "visit_dates": data.get("visit_dates", []), # Ensure visit_dates is present for new patients
        "created_at": datetime.now()
    }
    
    # Basic validation (can be expanded)
    if not all([new_patient["name"], new_patient["age"], new_patient["gender"], new_patient["department"]]):
        return jsonify({"msg": "Missing required patient fields"}), 400

    # It's still good practice to check for duplicates, though less likely with robust ID generation
    if patients.find_one({"patient_id": new_patient["patient_id"]}):
        return jsonify({"msg": f"Patient with ID {new_patient['patient_id']} already exists."}), 409


    patients.insert_one(new_patient)
    new_patient['_id'] = str(new_patient['_id']) # Convert for response
    return jsonify(new_patient), 201

# Update a patient
@app.route("/patients/<string:patient_id>", methods=["PUT"])
@jwt_required()
@role_required(["doctor", "nurse", "admin"])
def update_patient(patient_id):
    data = request.get_json()
    
    updated_fields = {
        "name": data.get("name"),
        "age": data.get("age"),
        "gender": data.get("gender"),
        "department": data.get("department"),
        "contact_info": { # Ensure contact_info is updated as a nested object
            "phone": data.get("contact_info", {}).get("phone"),
            "email": data.get("contact_info", {}).get("email")
        },
        "current_prescriptions": data.get("current_prescriptions", []), # Ensure it's an array
        "medical_history": data.get("medical_history", []), # Ensure it's an array
    }
    # Remove None values so that fields not sent in request are not updated to None
    updated_fields = {k: v for k, v in updated_fields.items() if v is not None}

    result = patients.update_one(
        {"_id": ObjectId(patient_id)},
        {"$set": updated_fields}
    )

    if result.matched_count:
        updated_patient = patients.find_one({"_id": ObjectId(patient_id)})
        updated_patient['_id'] = str(updated_patient['_id']) # Convert for response
        return jsonify(updated_patient), 200
    return jsonify({"msg": "Patient not found"}), 404

@app.route("/patients/<string:patient_id>", methods=["DELETE"])
@jwt_required()
@role_required(["doctor", "admin"])
def delete_patient(patient_id):
    print(f"DEBUG (Flask): Received DELETE request for patient_id: {patient_id}") # <--- THIS LINE
    try:
        if not ObjectId.is_valid(patient_id):
            print(f"DEBUG (Flask): Invalid ObjectId format: {patient_id}") # <--- AND THIS LINE
            return jsonify({"msg": "Invalid patient ID format"}), 400

        result = patients.delete_one({"_id": ObjectId(patient_id)})

        print(f"DEBUG (Flask): delete_one result for ID {patient_id}: deleted_count = {result.deleted_count}") # <--- AND THIS LINE

        if result.deleted_count == 1:
            return jsonify({"msg": "Patient deleted successfully"}), 200
        else:
            return jsonify({"msg": "Patient not found"}), 404
    except Exception as e:
        print(f"DEBUG (Flask): Exception during delete for ID {patient_id}: {e}") # <--- AND THIS LINE
        return jsonify({"msg": f"An error occurred on server: {str(e)}"}), 500

# --- Analytics Endpoints ---

@app.route("/analytics/gender-distribution")
@jwt_required()
@role_required(["doctor", "admin"])
def gender_distribution():
    pipeline = [
        {"$group": {"_id": "$gender", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    return jsonify(list(patients.aggregate(pipeline))) # CORRECTED: use patients collection


@app.route("/analytics/department-distribution")
@jwt_required()
@role_required(["doctor", "admin"])
def department_distribution():
    pipeline = [
        {"$group": {"_id": "$department", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    return jsonify(list(patients.aggregate(pipeline)))

@app.route("/analytics/frequent-visitors")
@jwt_required()
@role_required(["doctor", "admin"])
def frequent_visitors():
    pipeline = [
        {"$match": {"visit_dates": {"$exists": True, "$type": "array", "$not": {"$size": 0}}}}, # Ensure not empty array
        {"$project": {"name": 1, "patient_id": 1, "visit_count": {"$size": "$visit_dates"}}},
        {"$sort": {"visit_count": -1}},
        {"$limit": 10}
    ]
    
    results = list(patients.aggregate(pipeline))

    # Convert ObjectId to string for JSON serialization
    for doc in results:
        if '_id' in doc: # Check if _id exists in the aggregated result
            doc['_id'] = str(doc['_id']) 

    return jsonify(results)


if __name__ == "__main__":
    # --- Initial user setup (for demonstration purposes) ---
    # Hash passwords before inserting them
    if not users.find_one({"username": "admin"}):
        admin_password_hash = generate_password_hash("adminpass")
        users.insert_one({"username": "admin", "password": admin_password_hash, "roles": ["admin"]})
        print("Default admin user created: username='admin', password='adminpass'")
    
    if not users.find_one({"username": "doctor1"}):
        doctor_password_hash = generate_password_hash("docpass")
        users.insert_one({"username": "doctor1", "password": doctor_password_hash, "roles": ["doctor"]})
        print("Default doctor user created: username='doctor1', password='docpass'")

    if not users.find_one({"username": "nurse1"}):
        nurse_password_hash = generate_password_hash("nursepass")
        users.insert_one({"username": "nurse1", "password": nurse_password_hash, "roles": ["nurse"]})
        print("Default nurse user created: username='nurse1', password='nursepass'")
        
    app.run(debug=True)