plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Hra je ve složce ryby/ v kořeni repa. Do APK se kopíruje jako assets/web,
// bez testů a nástrojů; soubory se tedy udržují jen na jednom místě.
val gameAssets = layout.buildDirectory.dir("gameAssets")
val syncGame = tasks.register<Sync>("syncGame") {
    from(rootProject.file("ryby")) {
        exclude("tests/**", "tools/**")
    }
    into(gameAssets.map { it.dir("web") })
}

android {
    namespace = "cz.ryby.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "cz.ryby.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.1"
    }

    sourceSets["main"].assets.srcDir(gameAssets)

    // Podepisování release buildu: stejné proměnné prostředí jako u Ženisty (GitHub Actions).
    // Když chybí, vznikne debug APK.
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

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

tasks.named("preBuild") { dependsOn(syncGame) }

dependencies {
    implementation("androidx.webkit:webkit:1.11.0")
}
