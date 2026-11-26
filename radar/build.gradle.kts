plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "cz.zenista.radar"
    compileSdk = 34

    defaultConfig {
        applicationId = "cz.zenista.radar"
        minSdk = 26
        targetSdk = 34
        versionCode = 2
        versionName = "1.1"
    }

    // Stejné podepisování jako u Ženisty: bez proměnných prostředí vznikne debug APK.
    fun prop(name: String): String? = System.getenv(name) ?: (project.findProperty(name) as String?)
    val ksPath = prop("ZENISTA_KEYSTORE")
    if (ksPath != null) {
        signingConfigs {
            create("release") {
                storeFile = file(ksPath)
                storePassword = prop("ZENISTA_KEYSTORE_PASSWORD")
                keyAlias = prop("ZENISTA_KEY_ALIAS")
                keyPassword = prop("ZENISTA_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (ksPath != null) signingConfig = signingConfigs.getByName("release")
        }
    }

    // The model and wasm are read straight from the APK; compressing them gains little.
    androidResources {
        noCompress += listOf("tflite", "wasm")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.11.0")
}
